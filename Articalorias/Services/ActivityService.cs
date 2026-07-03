using Articalorias.Data;
using Articalorias.Exceptions;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Services;

public class ActivityService : IActivityService
{
    private readonly AppDbContext _db;
    private readonly IRecalculationService _recalculation;

    public ActivityService(AppDbContext db, IRecalculationService recalculation)
    {
        _db = db;
        _recalculation = recalculation;
    }

    // ── Activity entries (daily records) ──

    public async Task<IReadOnlyList<ActivityEntry>> GetEntriesByDailyLogAsync(long dailyLogId)
    {
        return await _db.ActivityEntries
            .AsNoTracking()
            .Where(a => a.DailyLogId == dailyLogId)
            .OrderBy(a => a.SortOrder)
            .ToListAsync();
    }

    public async Task<ActivityEntry> CreateEntryAsync(ActivityEntry entry)
    {
        var dailyLog = await _db.DailyLogs.FindAsync(entry.DailyLogId)
            ?? throw new InvalidOperationException("DailyLog not found.");

        CalculateActivityCalories(entry, dailyLog.SnapshotWeightKg ?? 0m);

        // Validate available-time cap: 24h minus reserved sleep & NEAT hours
        var reservedMinutes = ((dailyLog.SnapshotSleepHours ?? 0m) + (dailyLog.SnapshotNeatHours ?? 0m)) * 60m;
        var availableMinutes = 1440m - reservedMinutes;
        var existingMinutes = await _db.ActivityEntries
            .Where(a => a.DailyLogId == entry.DailyLogId)
            .SumAsync(a => a.DurationMinutes ?? 0m);
        var newEntryMinutes = entry.DurationMinutes ?? 0m;

        if (existingMinutes + newEntryMinutes > availableMinutes)
            throw new ApiException(ErrorCodes.ActivityDurationExceeded,
                $"Activity duration exceeds the available time for this day " +
                $"({availableMinutes / 60m:F1} h available, {existingMinutes / 60m:F1} h already logged).");

        var maxSort = await _db.ActivityEntries
            .Where(a => a.DailyLogId == entry.DailyLogId)
            .MaxAsync(a => (int?)a.SortOrder) ?? 0;
        entry.SortOrder = maxSort + 1;

        _db.ActivityEntries.Add(entry);
        await _db.SaveChangesAsync();

        await _recalculation.RecalculateFullPipelineAsync(entry.DailyLogId);
        return entry;
    }

    public async Task<ActivityEntry> UpdateEntryAsync(ActivityEntry entry)
    {
        var existing = await _db.ActivityEntries
            .Include(a => a.ActivityTemplate)
            .FirstOrDefaultAsync(a => a.ActivityEntryId == entry.ActivityEntryId)
            ?? throw new InvalidOperationException("ActivityEntry not found.");

        var dailyLog = await _db.DailyLogs.FindAsync(existing.DailyLogId)
            ?? throw new InvalidOperationException("DailyLog not found.");

        existing.ActivityName = entry.ActivityName;
        existing.DurationMinutes = entry.DurationMinutes;
        existing.METValue = entry.METValue;

        existing.UpdatedAtUtc = DateTime.UtcNow;
        CalculateActivityCalories(existing, dailyLog.SnapshotWeightKg ?? 0m);

        // Validate available-time cap: 24h minus reserved sleep & NEAT hours
        var reservedMinutes = ((dailyLog.SnapshotSleepHours ?? 0m) + (dailyLog.SnapshotNeatHours ?? 0m)) * 60m;
        var availableMinutes = 1440m - reservedMinutes;
        var otherMinutes = await _db.ActivityEntries
            .Where(a => a.DailyLogId == existing.DailyLogId && a.ActivityEntryId != existing.ActivityEntryId)
            .SumAsync(a => a.DurationMinutes ?? 0m);
        var updatedMinutes = existing.DurationMinutes ?? 0m;

        if (otherMinutes + updatedMinutes > availableMinutes)
            throw new ApiException(ErrorCodes.ActivityDurationExceeded,
                $"Activity duration exceeds the available time for this day " +
                $"({availableMinutes / 60m:F1} h available, {otherMinutes / 60m:F1} h from other activities).");

        await _db.SaveChangesAsync();

        await _recalculation.RecalculateFullPipelineAsync(existing.DailyLogId);
        return existing;
    }

    public async Task DeleteEntryAsync(long activityEntryId)
    {
        var entry = await _db.ActivityEntries.FindAsync(activityEntryId)
            ?? throw new InvalidOperationException("ActivityEntry not found.");

        var dailyLogId = entry.DailyLogId;
        _db.ActivityEntries.Remove(entry);
        await _db.SaveChangesAsync();

        await _recalculation.RecalculateFullPipelineAsync(dailyLogId);
    }

    // ── Activity templates (catalog) ──

    public async Task<IReadOnlyList<ActivityTemplate>> GetTemplatesAsync(long? userId)
    {
        return await _db.ActivityTemplates
            .Where(t => t.IsActive && t.UserId == userId)
            .OrderBy(t => t.TemplateName)
            .ToListAsync();
    }

    public async Task<ActivityTemplate> CreateTemplateAsync(ActivityTemplate template)
    {
        _db.ActivityTemplates.Add(template);
        await _db.SaveChangesAsync();
        return template;
    }

    public async Task<ActivityTemplate?> UpdateTemplateAsync(ActivityTemplate template)
    {
        var existing = await _db.ActivityTemplates
            .FirstOrDefaultAsync(t => t.ActivityTemplateId == template.ActivityTemplateId
                && t.IsActive
                && t.UserId == template.UserId);

        if (existing is null) return null;

        existing.TemplateName = template.TemplateName;
        existing.AutoAddToNewDay = template.AutoAddToNewDay;
        existing.DefaultDurationMinutes = template.DefaultDurationMinutes;
        existing.DefaultMET = template.DefaultMET;
        existing.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return existing;
    }

    public async Task<bool> DeleteTemplateAsync(long activityTemplateId, long userId)
    {
        var template = await _db.ActivityTemplates
            .FirstOrDefaultAsync(t => t.ActivityTemplateId == activityTemplateId
                && t.UserId == userId
                && t.IsActive);

        if (template is null) return false;

        template.IsActive = false;
        template.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Calculation logic ──

    private static void CalculateActivityCalories(ActivityEntry entry, decimal weightKg)
    {
        // Formula: Calories = (MET - 1) × weight(kg) × duration(hours)
        // We subtract 1 MET because BMR (≈ 1 MET) is already accounted for
        // separately in the total daily expenditure calculation.
        if (entry.METValue.HasValue && entry.DurationMinutes.HasValue)
        {
            var netMet = entry.METValue.Value - 1m;
            entry.CalculatedCaloriesKcal =
                netMet * weightKg * (entry.DurationMinutes.Value / 60m);
        }
    }
}
