using Articalorias.Configuration;
using Articalorias.Data;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Services;

public class DailyLogService : IDailyLogService
{
    private readonly AppDbContext _db;
    private readonly IRecalculationService _recalculation;

    public DailyLogService(AppDbContext db, IRecalculationService recalculation)
    {
        _db = db;
        _recalculation = recalculation;
    }

    public async Task<DailyLog?> GetByDateAsync(long userId, DateOnly date)
    {
        return await _db.DailyLogs
            .Include(d => d.FoodEntries.OrderBy(f => f.SortOrder))
            .Include(d => d.ActivityEntries.OrderBy(a => a.SortOrder))
                .ThenInclude(a => a.Segments.OrderBy(s => s.SegmentOrder))
            .FirstOrDefaultAsync(d => d.UserId == userId && d.LogDate == date);
    }

    public async Task<IReadOnlyList<DailyLog>> GetRangeAsync(long userId, DateOnly from, DateOnly to)
    {
        return await _db.DailyLogs
            .Where(d => d.UserId == userId && d.LogDate >= from && d.LogDate <= to)
            .OrderBy(d => d.LogDate)
            .ToListAsync();
    }

    public async Task<DailyLog> GetOrCreateAsync(long userId, DateOnly date)
    {
        var existing = await GetByDateAsync(userId, date);
        if (existing is not null)
            return existing;

        var profile = await _db.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId)
            ?? throw new InvalidOperationException("User profile not found. Complete onboarding first.");

        var proteinGoal = profile.ProteinGoalGrams
            ?? (profile.AutoCalculateProteinGoal ? profile.CurrentWeightKg * 2.0m : 0m);

        var (weekStart, weekEnd) = GetWeekRange(date);

        var dailyLog = new DailyLog
        {
            UserId = userId,
            LogDate = date,

            // Snapshot from current profile
            SnapshotWeightKg = profile.CurrentWeightKg,
            SnapshotHeightCm = profile.HeightCm,
            SnapshotBMRKcal = profile.BMRKcal,
            SnapshotBodyFatPercent = profile.BodyFatPercent,
            SnapshotDailyBaseGoalKcal = profile.DailyBaseGoalKcal,
            SnapshotProteinGoalGrams = proteinGoal,

            WeekStartDate = weekStart,
            WeekEndDate = weekEnd
        };

        _db.DailyLogs.Add(dailyLog);
        await _db.SaveChangesAsync();

        // Auto-add global default activities (Sleep, NEAT, etc.)
        var globalSortOrder = 1;
        foreach (var gd in GlobalDefaultActivities.All)
        {
            var entry = new ActivityEntry
            {
                DailyLogId = dailyLog.DailyLogId,
                ActivityType = "MET_SIMPLE",
                ActivityName = gd.Name,
                DurationMinutes = gd.DefaultDurationMinutes,
                METValue = gd.METValue,
                IsGlobalDefault = true,
                SortOrder = globalSortOrder++,
            };

            CalculateActivityCalories(entry, dailyLog.SnapshotWeightKg);
            _db.ActivityEntries.Add(entry);
        }

        await _db.SaveChangesAsync();

        // Auto-add activity entries from templates with AutoAddToNewDay = true,
        // but skip any whose name already matches a global default we just added.
        var globalNames = GlobalDefaultActivities.All.Select(g => g.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var autoAddTemplates = await _db.ActivityTemplates
            .Include(t => t.Segments)
            .Where(t => t.IsActive && t.AutoAddToNewDay && (t.TemplateScope == "SYSTEM" || t.UserId == userId))
            .ToListAsync();
        autoAddTemplates = autoAddTemplates
            .Where(t => !globalNames.Contains(t.TemplateName))
            .ToList();

        if (autoAddTemplates.Count > 0)
        {
            var sortOrder = GlobalDefaultActivities.All.Count + 1;
            foreach (var template in autoAddTemplates)
            {
                var entry = new ActivityEntry
                {
                    DailyLogId = dailyLog.DailyLogId,
                    ActivityTemplateId = template.ActivityTemplateId,
                    ActivityType = template.ActivityType,
                    ActivityName = template.TemplateName,
                    DurationMinutes = template.DefaultDurationMinutes,
                    METValue = template.DefaultMET,
                    SortOrder = sortOrder++,
                    Segments = template.Segments.Select(s => new ActivityEntrySegment
                    {
                        SegmentOrder = s.SegmentOrder,
                        SegmentName = s.SegmentName,
                        METValue = s.METValue,
                        DurationMinutes = s.DefaultDurationMinutes
                    }).ToList()
                };

                CalculateActivityCalories(entry, dailyLog.SnapshotWeightKg);
                _db.ActivityEntries.Add(entry);
            }

            await _db.SaveChangesAsync();
        }

        // Run full pipeline on the new day
        await _recalculation.RecalculateFullPipelineAsync(dailyLog.DailyLogId);

        return (await GetByDateAsync(userId, date))!;
    }

    public async Task RecalculateAsync(long dailyLogId)
    {
        // Delegate to the authoritative pipeline
        await _recalculation.RecalculateFullPipelineAsync(dailyLogId);
    }

    private static (DateOnly weekStart, DateOnly weekEnd) GetWeekRange(DateOnly date)
    {
        var daysFromMonday = ((int)date.DayOfWeek + 6) % 7;
        var monday = date.AddDays(-daysFromMonday);
        var sunday = monday.AddDays(6);
        return (monday, sunday);
    }

    private static void CalculateActivityCalories(ActivityEntry entry, decimal weightKg)
    {
        // Subtract 1 MET: BMR is already counted separately in total expenditure.
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
