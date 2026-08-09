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

    public async Task<ActivityEntry> CreateEntryAsync(ActivityEntry entry, decimal? providedCaloriesKcal = null)
    {
        var dailyLog = await _db.DailyLogs.FindAsync(entry.DailyLogId)
            ?? throw new InvalidOperationException("DailyLog not found.");

        ValidateEntryInput(entry, providedCaloriesKcal);
        ActivityCalorieMath.Apply(entry, dailyLog.SnapshotWeightKg ?? 0m, providedCaloriesKcal);

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

    public async Task<ActivityEntry> UpdateEntryAsync(ActivityEntry entry, decimal? providedCaloriesKcal = null)
    {
        var existing = await _db.ActivityEntries
            .Include(a => a.ActivityTemplate)
            .FirstOrDefaultAsync(a => a.ActivityEntryId == entry.ActivityEntryId)
            ?? throw new InvalidOperationException("ActivityEntry not found.");

        var dailyLog = await _db.DailyLogs.FindAsync(existing.DailyLogId)
            ?? throw new InvalidOperationException("DailyLog not found.");

        ValidateEntryInput(entry, providedCaloriesKcal);

        existing.ActivityName = entry.ActivityName;
        existing.DurationMinutes = entry.DurationMinutes;
        existing.METValue = entry.METValue;

        existing.UpdatedAtUtc = DateTime.UtcNow;
        ActivityCalorieMath.Apply(existing, dailyLog.SnapshotWeightKg ?? 0m, providedCaloriesKcal);

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

    // ── Validation ──

    /// <summary>
    /// An entry is computable when it carries MET + duration (classic path) or a
    /// directly provided calorie burn (smart-watch path). Anything else would
    /// persist a permanent 0 kcal row, so it is rejected with a clear message.
    /// </summary>
    private static void ValidateEntryInput(ActivityEntry entry, decimal? providedCaloriesKcal)
    {
        var hasMetAndDuration = entry.METValue is > 0m && entry.DurationMinutes is > 0m;
        var hasCalories = providedCaloriesKcal is > 0m;

        if (!hasMetAndDuration && !hasCalories)
            throw new ApiException(ErrorCodes.InvalidInput,
                "Provide either a duration and intensity (MET), or the calories burned.");
    }
}
