using Articalorias.Data;
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
            .Include(a => a.ActivityTemplate)
            .Include(a => a.Segments.OrderBy(s => s.SegmentOrder))
            .Where(a => a.DailyLogId == dailyLogId)
            .OrderBy(a => a.SortOrder)
            .ToListAsync();
    }

    public async Task<ActivityEntry> CreateEntryAsync(ActivityEntry entry)
    {
        var dailyLog = await _db.DailyLogs.FindAsync(entry.DailyLogId)
            ?? throw new InvalidOperationException("DailyLog not found.");

        CalculateActivityCalories(entry, dailyLog.SnapshotWeightKg);

        // Validate 24-hour cap
        var existingMinutes = await _db.ActivityEntries
            .Where(a => a.DailyLogId == entry.DailyLogId)
            .SumAsync(a => a.DurationMinutes ?? 0m);
        var newEntryMinutes = entry.DurationMinutes ?? 0m;

        if (existingMinutes + newEntryMinutes > 1440m)
            throw new InvalidOperationException(
                $"Cannot exceed 24 hours of activities per day. " +
                $"Already logged: {existingMinutes / 60m:F1}h. " +
                $"Attempted to add: {newEntryMinutes / 60m:F1}h.");

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
            .Include(a => a.Segments)
            .Include(a => a.ActivityTemplate)
            .FirstOrDefaultAsync(a => a.ActivityEntryId == entry.ActivityEntryId)
            ?? throw new InvalidOperationException("ActivityEntry not found.");

        var dailyLog = await _db.DailyLogs.FindAsync(existing.DailyLogId)
            ?? throw new InvalidOperationException("DailyLog not found.");

        var isDurationOnly = existing.IsGlobalDefault
            || existing.ActivityTemplate?.TemplateScope == "SYSTEM";

        if (isDurationOnly)
        {
            // Global defaults and SYSTEM-template entries: only duration may be changed
            existing.DurationMinutes = entry.DurationMinutes;
        }
        else
        {
            existing.ActivityType = entry.ActivityType;
            existing.ActivityName = entry.ActivityName;
            existing.DurationMinutes = entry.DurationMinutes;
            existing.DirectCaloriesKcal = entry.DirectCaloriesKcal;
            existing.METValue = entry.METValue;
            existing.Notes = entry.Notes;

            // Replace segments
            _db.ActivityEntrySegments.RemoveRange(existing.Segments);
            foreach (var seg in entry.Segments)
            {
                seg.ActivityEntryId = existing.ActivityEntryId;
                _db.ActivityEntrySegments.Add(seg);
            }
        }

        existing.UpdatedAtUtc = DateTime.UtcNow;
        CalculateActivityCalories(existing, dailyLog.SnapshotWeightKg);

        // Validate 24-hour cap (exclude current entry from existing total)
        var otherMinutes = await _db.ActivityEntries
            .Where(a => a.DailyLogId == existing.DailyLogId && a.ActivityEntryId != existing.ActivityEntryId)
            .SumAsync(a => a.DurationMinutes ?? 0m);
        var updatedMinutes = existing.DurationMinutes ?? 0m;

        if (otherMinutes + updatedMinutes > 1440m)
            throw new InvalidOperationException(
                $"Cannot exceed 24 hours of activities per day. " +
                $"Other activities: {otherMinutes / 60m:F1}h. " +
                $"This entry: {updatedMinutes / 60m:F1}h.");

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
            .Include(t => t.Segments.OrderBy(s => s.SegmentOrder))
            .Where(t => t.IsActive && (t.TemplateScope == "SYSTEM" || t.UserId == userId))
            .OrderBy(t => t.TemplateName)
            .ToListAsync();
    }

    public async Task<ActivityTemplate> CreateTemplateAsync(ActivityTemplate template)
    {
        _db.ActivityTemplates.Add(template);
        await _db.SaveChangesAsync();
        return template;
    }

    public async Task<ActivityTemplate> UpdateTemplateAsync(ActivityTemplate template)
    {
        var existing = await _db.ActivityTemplates
            .Include(t => t.Segments)
            .FirstOrDefaultAsync(t => t.ActivityTemplateId == template.ActivityTemplateId)
            ?? throw new InvalidOperationException("ActivityTemplate not found.");

        if (existing.TemplateScope == "SYSTEM")
        {
            // Only allow toggling AutoAddToNewDay on system templates
            existing.AutoAddToNewDay = template.AutoAddToNewDay;
            existing.UpdatedAtUtc = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            await _db.Entry(existing).Collection(t => t.Segments).LoadAsync();
            return existing;
        }

        existing.TemplateName = template.TemplateName;
        existing.ActivityType = template.ActivityType;
        existing.AutoAddToNewDay = template.AutoAddToNewDay;
        existing.DefaultDurationMinutes = template.DefaultDurationMinutes;
        existing.DefaultDirectCaloriesKcal = template.DefaultDirectCaloriesKcal;
        existing.DefaultMET = template.DefaultMET;
        existing.UpdatedAtUtc = DateTime.UtcNow;

        // Replace segments
        _db.ActivityTemplateSegments.RemoveRange(existing.Segments);
        foreach (var seg in template.Segments)
        {
            seg.ActivityTemplateId = existing.ActivityTemplateId;
            _db.ActivityTemplateSegments.Add(seg);
        }

        await _db.SaveChangesAsync();

        // Reload segments for the response
        await _db.Entry(existing).Collection(t => t.Segments).LoadAsync();
        return existing;
    }

    public async Task DeleteTemplateAsync(long activityTemplateId)
    {
        var template = await _db.ActivityTemplates.FindAsync(activityTemplateId)
            ?? throw new InvalidOperationException("ActivityTemplate not found.");

        if (template.TemplateScope == "SYSTEM")
            throw new InvalidOperationException("System templates cannot be deleted.");

        template.IsActive = false;
        template.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    // ── Calculation logic ──

    private static void CalculateActivityCalories(ActivityEntry entry, decimal weightKg)
    {
        // Formula: Calories = (MET - 1) × weight(kg) × duration(hours)
        // We subtract 1 MET because BMR (≈ 1 MET) is already accounted for
        // separately in the total daily expenditure calculation.
        switch (entry.ActivityType)
        {
            case "MET_SIMPLE":
                if (entry.METValue.HasValue && entry.DurationMinutes.HasValue)
                {
                    var netMet = Math.Max(0m, entry.METValue.Value - 1m);
                    entry.CalculatedCaloriesKcal =
                        netMet * weightKg * (entry.DurationMinutes.Value / 60m);
                }
                break;

            case "MET_MULTIPLE":
                decimal total = 0;
                foreach (var seg in entry.Segments)
                {
                    var netSegMet = Math.Max(0m, seg.METValue - 1m);
                    seg.CalculatedCaloriesKcal = netSegMet * weightKg * (seg.DurationMinutes / 60m);
                    total += seg.CalculatedCaloriesKcal;
                }
                entry.CalculatedCaloriesKcal = total;
                entry.DurationMinutes = entry.Segments.Sum(s => s.DurationMinutes);
                break;
        }
    }
}
