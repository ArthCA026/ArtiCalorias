using Articalorias.Data;
using Articalorias.DTOs.Measurements;
using Articalorias.Exceptions;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Services;

/// <summary>
/// Dated weight / body-fat measurements behind the Body page graph.
///
/// Sync contract with the profile (both directions, so they never disagree):
///  - Profile saves record a "profile"-sourced measurement for the local today.
///  - Saving or deleting the NEWEST measurement writes its values back to
///    UserProfile.CurrentWeightKg / BodyFatPercent and refreshes today's day
///    snapshot. Older measurements only change the graph: past day snapshots
///    stay frozen by the same rule the whole recalculation pipeline follows.
/// </summary>
public class BodyMeasurementService : IBodyMeasurementService
{
    private readonly AppDbContext _db;
    private readonly IRecalculationService _recalculation;

    public BodyMeasurementService(AppDbContext db, IRecalculationService recalculation)
    {
        _db = db;
        _recalculation = recalculation;
    }

    public async Task<IReadOnlyList<BodyMeasurementResponse>> GetAllAsync(long userId, CancellationToken ct = default)
    {
        return await _db.BodyMeasurements
            .AsNoTracking()
            .Where(m => m.UserId == userId)
            .OrderBy(m => m.MeasuredOn)
            .Select(m => new BodyMeasurementResponse
            {
                MeasuredOn = m.MeasuredOn,
                WeightKg = m.WeightKg,
                BodyFatPercent = m.BodyFatPercent,
                Source = m.Source,
            })
            .ToListAsync(ct);
    }

    public async Task<BodyMeasurementResponse> UpsertAsync(long userId, DateOnly date, UpsertBodyMeasurementRequest request, DateOnly localToday, CancellationToken ct = default)
    {
        if (date > localToday)
            throw new ApiException(ErrorCodes.InvalidInput, "A measurement cannot be in the future.");
        if (request.WeightKg is null && request.BodyFatPercent is null)
            throw new ApiException(ErrorCodes.InvalidInput, "Enter a weight or a body fat percentage.");

        var row = await _db.BodyMeasurements
            .FirstOrDefaultAsync(m => m.UserId == userId && m.MeasuredOn == date, ct);

        if (row is null)
        {
            row = new BodyMeasurement
            {
                UserId = userId,
                MeasuredOn = date,
                Source = "manual",
                CreatedAtUtc = DateTime.UtcNow,
            };
            _db.BodyMeasurements.Add(row);
        }

        // Nulls leave the existing value alone so "just update my weight"
        // never erases the body fat recorded that morning.
        if (request.WeightKg.HasValue) row.WeightKg = request.WeightKg;
        if (request.BodyFatPercent.HasValue) row.BodyFatPercent = request.BodyFatPercent;
        row.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        await SyncProfileToNewestAsync(userId, localToday,
            explicitBodyFatProvided: request.BodyFatPercent.HasValue && IsNewest(row, await NewestDateAsync(userId, ct)), ct);

        return new BodyMeasurementResponse
        {
            MeasuredOn = row.MeasuredOn,
            WeightKg = row.WeightKg,
            BodyFatPercent = row.BodyFatPercent,
            Source = row.Source,
        };
    }

    public async Task<bool> DeleteAsync(long userId, DateOnly date, DateOnly localToday, CancellationToken ct = default)
    {
        var row = await _db.BodyMeasurements
            .FirstOrDefaultAsync(m => m.UserId == userId && m.MeasuredOn == date, ct);
        if (row is null)
            return false;

        _db.BodyMeasurements.Remove(row);
        await _db.SaveChangesAsync(ct);

        await SyncProfileToNewestAsync(userId, localToday, explicitBodyFatProvided: false, ct);
        return true;
    }

    public async Task<int> DeleteBatchAsync(long userId, IReadOnlyList<DateOnly> dates, DateOnly localToday, CancellationToken ct = default)
    {
        if (dates.Count == 0)
            return 0;

        var rows = await _db.BodyMeasurements
            .Where(m => m.UserId == userId && dates.Contains(m.MeasuredOn))
            .ToListAsync(ct);

        if (rows.Count == 0)
            return 0;

        _db.BodyMeasurements.RemoveRange(rows);
        await _db.SaveChangesAsync(ct);

        // One profile sync for the whole batch: if the newest measurement fell,
        // the profile follows whichever measurement now leads.
        await SyncProfileToNewestAsync(userId, localToday, explicitBodyFatProvided: false, ct);
        return rows.Count;
    }

    public async Task RecordFromProfileAsync(long userId, CancellationToken ct = default)
    {
        var profile = await _db.UserProfiles.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == userId, ct);
        if (profile is null || !profile.CurrentWeightKg.HasValue)
            return;

        var today = LocalDates.TodayFor(profile.TimeZoneId);
        var row = await _db.BodyMeasurements
            .FirstOrDefaultAsync(m => m.UserId == userId && m.MeasuredOn == today, ct);

        if (row is null)
        {
            row = new BodyMeasurement
            {
                UserId = userId,
                MeasuredOn = today,
                CreatedAtUtc = DateTime.UtcNow,
            };
            _db.BodyMeasurements.Add(row);
        }

        row.WeightKg = profile.CurrentWeightKg;
        // Only a user-entered body fat is real data; an auto-calculated value
        // is an estimate and estimates are derived at display time instead of
        // being stored as if they were measured.
        if (!profile.AutoCalculateBodyFat && profile.BodyFatPercent.HasValue)
            row.BodyFatPercent = profile.BodyFatPercent;
        row.Source = "profile";
        row.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
    }

    // ── Private helpers ───────────────────────────────────────────────────

    private async Task<DateOnly?> NewestDateAsync(long userId, CancellationToken ct)
    {
        return await _db.BodyMeasurements
            .AsNoTracking()
            .Where(m => m.UserId == userId)
            .MaxAsync(m => (DateOnly?)m.MeasuredOn, ct);
    }

    private static bool IsNewest(BodyMeasurement row, DateOnly? newest)
        => newest.HasValue && row.MeasuredOn == newest.Value;

    /// <summary>
    /// Makes the profile mirror the newest measurement, re-runs the automatic
    /// BMR / body-fat formulas and refreshes today's snapshot so the ring and
    /// budgets move immediately.
    /// </summary>
    private async Task SyncProfileToNewestAsync(long userId, DateOnly localToday, bool explicitBodyFatProvided, CancellationToken ct)
    {
        var profile = await _db.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId, ct);
        if (profile is null)
            return;

        var newest = await _db.BodyMeasurements
            .AsNoTracking()
            .Where(m => m.UserId == userId)
            .OrderByDescending(m => m.MeasuredOn)
            .FirstOrDefaultAsync(ct);

        if (newest is null)
            return; // Last measurement deleted: the profile keeps its values.

        var changed = false;

        if (newest.WeightKg.HasValue && newest.WeightKg != profile.CurrentWeightKg)
        {
            profile.CurrentWeightKg = newest.WeightKg;
            changed = true;
        }

        if (newest.BodyFatPercent.HasValue && explicitBodyFatProvided)
        {
            // The user recorded a real body-fat number (smart scale, caliper):
            // from now on the profile uses IT, not the formula estimate. Auto
            // mode can always be turned back on from Body details.
            profile.BodyFatPercent = newest.BodyFatPercent;
            profile.AutoCalculateBodyFat = false;
            changed = true;
        }

        if (!changed)
            return;

        UserProfileService.ApplyAutoCalculations(profile);
        profile.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        // Only TODAY follows the new numbers; past day snapshots are frozen
        // history and editing an old measurement must not rewrite them.
        await _recalculation.RefreshSnapshotAndRecalculateAsync(userId, localToday);
    }
}
