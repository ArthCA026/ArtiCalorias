using Articalorias.Data;
using Articalorias.Exceptions;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Services;

public class DailyLogService : IDailyLogService
{
    /// <summary>
    /// Auto-add stops when the user has not actively opened the app for this
    /// many days. Without the pause, an abandoned session that keeps requesting
    /// dashboards would fabricate meals and burn calculations forever (zombie
    /// days). A returning user's first heartbeat re-arms auto-add before their
    /// dashboard request lands, so a real comeback day is never left empty.
    /// </summary>
    public const int AutoAddPauseAfterDays = 3;

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

        var proteinGoal = ProteinMath.GoalGrams(profile);

        var (weekStart, weekEnd) = GetWeekRange(date);

        var macroPrefs = await _db.UserMacroPreferences
            .AsNoTracking()
            .Where(m => m.UserId == userId)
            .ToListAsync();

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
            MacroTargetsJson = MacroTargets.BuildJson(profile, macroPrefs),

            WeekStartDate = weekStart,
            WeekEndDate = weekEnd
        };

        _db.DailyLogs.Add(dailyLog);
        await _db.SaveChangesAsync();

        // ── Auto-add templates — but only when this row is the user's actual
        // TODAY, and only for users who are actually around to eat them.
        //
        // 1. Local-today check: browsing an old (or future) date creates its
        //    row for viewing/editing, and auto-adding meals to a day the user
        //    opened just to LOOK at would silently rewrite their history.
        // 2. Activity window: if the user has not actively opened the app in
        //    AutoAddPauseAfterDays, the routine meals stop materializing, so an
        //    abandoned account or a forgotten open tab cannot generate zombie
        //    logs every midnight. NULL LastActiveAtUtc (brand-new account or
        //    pre-feature user mid-rollout) counts as active: pausing them
        //    would break auto-add on their very first day.
        var isUsersToday = date == LocalDates.TodayFor(profile.TimeZoneId);
        var lastActive = await _db.Users
            .AsNoTracking()
            .Where(u => u.UserId == userId)
            .Select(u => u.LastActiveAtUtc)
            .FirstOrDefaultAsync();
        var isUserActive = lastActive is null
            || DateTime.UtcNow - lastActive.Value <= TimeSpan.FromDays(AutoAddPauseAfterDays);

        var autoAddedFood = false;
        if (isUsersToday && isUserActive)
        {
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
                _db.FoodEntries.Add(FoodTemplateMath.ToEntry(template, dailyLog.DailyLogId, foodSortOrder++));
                autoAddedFood = true;
            }

            await _db.SaveChangesAsync();
        }

        // Run full pipeline on the new day
        await _recalculation.RecalculateFullPipelineAsync(dailyLog.DailyLogId);

        // Auto-added meals make the day "logged", which extends the streak the
        // moment the user opens the app. Without this, the streak (and its
        // celebration) sat stale until the first MANUAL log, which auto-add
        // users may never make on a routine day.
        if (autoAddedFood)
            await _streak.RecalculateForUserAsync(userId);

        return (await GetSummaryByDateAsync(userId, date))!;
    }

    public async Task RecalculateAsync(long dailyLogId)
    {
        // Delegate to the authoritative pipeline
        await _recalculation.RecalculateFullPipelineAsync(dailyLogId);
    }

    public async Task DeleteByDateAsync(long userId, DateOnly date)
    {
        // "Current day" on the user's calendar, not UTC's: behind-UTC users in
        // the evening would otherwise be able to delete their live today.
        var tz = await _db.UserProfiles
            .AsNoTracking()
            .Where(p => p.UserId == userId)
            .Select(p => p.TimeZoneId)
            .FirstOrDefaultAsync();
        var today = LocalDates.TodayFor(tz);
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
