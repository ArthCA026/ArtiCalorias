using Articalorias.Data;
using Articalorias.Exceptions;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Services;

public class DailyLogService : IDailyLogService
{
    private readonly AppDbContext _db;
    private readonly IRecalculationService _recalculation;
    private readonly IStreakService _streak;

    public DailyLogService(AppDbContext db, IRecalculationService recalculation, IStreakService streak)
    {
        _db = db;
        _recalculation = recalculation;
        _streak = streak;
    }

    public async Task<DailyLog?> GetSummaryByDateAsync(long userId, DateOnly date)
    {
        return await _db.DailyLogs
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.UserId == userId && d.LogDate == date);
    }

    public async Task<DailyLog?> GetByDateAsync(long userId, DateOnly date)
    {
        return await _db.DailyLogs
            .Include(d => d.FoodEntries.OrderBy(f => f.SortOrder))
            .Include(d => d.ActivityEntries.OrderBy(a => a.SortOrder))
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
        var existing = await GetSummaryByDateAsync(userId, date);
        if (existing is not null)
            return existing;

        var profile = await _db.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId)
            ?? throw new InvalidOperationException("User profile not found. Complete onboarding first.");

        var proteinGoal = profile.ProteinGoalGrams
            ?? (profile.AutoCalculateProteinGoal && profile.CurrentWeightKg.HasValue ? profile.CurrentWeightKg.Value * 2.0m : 0m);

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
            SnapshotSleepHours = profile.SleepHours,
            SnapshotNeatHours = profile.NeatHours,

            WeekStartDate = weekStart,
            WeekEndDate = weekEnd
        };

        _db.DailyLogs.Add(dailyLog);
        await _db.SaveChangesAsync();

        // Auto-add activity entries from templates with AutoAddToNewDay = true.
        var autoAddTemplates = await _db.ActivityTemplates
            .Where(t => t.IsActive && t.AutoAddToNewDay && t.UserId == userId)
            .ToListAsync();

        if (autoAddTemplates.Count > 0)
        {
            var sortOrder = 1;
            foreach (var template in autoAddTemplates)
            {
                var entry = new ActivityEntry
                {
                    DailyLogId = dailyLog.DailyLogId,
                    ActivityTemplateId = template.ActivityTemplateId,
                    ActivityName = template.TemplateName,
                    DurationMinutes = template.DefaultDurationMinutes,
                    METValue = template.DefaultMET,
                    SortOrder = sortOrder++,
                };

                ActivityCalorieMath.Apply(entry, dailyLog.SnapshotWeightKg ?? 0m, providedCaloriesKcal: null);
                _db.ActivityEntries.Add(entry);
            }
        }

        // Auto-add food entries from food templates with AutoAddToNewDay = true.
        var autoAddFoodTemplates = await _db.FoodTemplates
            .Where(f => f.IsActive && f.AutoAddToNewDay && f.UserId == userId)
            .ToListAsync();

        var foodSortOrder = 1;
        foreach (var template in autoAddFoodTemplates)
        {
            var foodEntry = new FoodEntry
            {
                DailyLogId = dailyLog.DailyLogId,
                FoodTemplateId = template.FoodTemplateId,
                FoodName = template.TemplateName,
                PortionDescription = template.PortionDescription,
                Quantity = template.DefaultQuantity,
                CaloriesKcal = template.CaloriesKcal,
                ProteinGrams = template.ProteinGrams,
                FatGrams = template.FatGrams,
                CarbsGrams = template.CarbsGrams,
                AlcoholGrams = template.AlcoholGrams,
                SortOrder = foodSortOrder++,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow,
            };
            _db.FoodEntries.Add(foodEntry);
        }

        await _db.SaveChangesAsync();

        // Run full pipeline on the new day
        await _recalculation.RecalculateFullPipelineAsync(dailyLog.DailyLogId);

        return (await GetSummaryByDateAsync(userId, date))!;
    }

    public async Task RecalculateAsync(long dailyLogId)
    {
        // Delegate to the authoritative pipeline
        await _recalculation.RecalculateFullPipelineAsync(dailyLogId);
    }

    public async Task DeleteByDateAsync(long userId, DateOnly date)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (date == today)
            throw new InvalidOperationException("You cannot delete the current day.");

        var log = await _db.DailyLogs
            .FirstOrDefaultAsync(d => d.UserId == userId && d.LogDate == date)
            ?? throw new InvalidOperationException("No log found for the specified date.");

        // Capture context needed for recalculation before deletion
        var weekStart = log.WeekStartDate;
        var weekEnd = log.WeekEndDate;
        var baseDailyGoal = log.SnapshotDailyBaseGoalKcal;

        _db.DailyLogs.Remove(log);
        await _db.SaveChangesAsync();

        // Recalculate affected weekly and monthly summaries
        await _recalculation.RecalculateAfterDayDeletionAsync(userId, date, weekStart, weekEnd, baseDailyGoal);
    }

    public async Task<DailyLog> SetFastingAsync(long userId, DateOnly date, bool isFasting, DateOnly referenceToday)
    {
        // Ensure the day exists (snapshots included) before flagging it.
        await GetOrCreateAsync(userId, date);

        // GetOrCreateAsync returns an untracked summary; re-query tracked.
        var log = await _db.DailyLogs
            .FirstAsync(d => d.UserId == userId && d.LogDate == date);

        if (log.IsFastingDay == isFasting)
            return log; // Idempotent: nothing to change, nothing to recalculate.

        if (isFasting)
        {
            // A fast and food entries cannot coexist. The UI only offers the
            // mark on an empty day, so hitting this means stale state or an
            // auto-added template meal: tell the user exactly what to do.
            var hasFood = await _db.FoodEntries.AnyAsync(f => f.DailyLogId == log.DailyLogId);
            if (hasFood)
                throw new ApiException(ErrorCodes.FastingDayHasFood,
                    "This day has meals logged. Remove them before marking it as a fasting day.");
        }

        log.IsFastingDay = isFasting;
        log.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // referenceToday keeps the user's real today un-frozen so it receives
        // the newly banked (or released) fasting balance; the cascade updates
        // the rest of the week. The streak follows: a fasting day qualifies.
        await _recalculation.RecalculateFullPipelineAsync(log.DailyLogId, referenceToday);
        await _streak.RecalculateForUserAsync(userId);

        return (await GetSummaryByDateAsync(userId, date))!;
    }

    private static (DateOnly weekStart, DateOnly weekEnd) GetWeekRange(DateOnly date)
    {
        var daysFromMonday = ((int)date.DayOfWeek + 6) % 7;
        var monday = date.AddDays(-daysFromMonday);
        var sunday = monday.AddDays(6);
        return (monday, sunday);
    }
}
