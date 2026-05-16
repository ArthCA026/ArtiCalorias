using Articalorias.Configuration;
using Articalorias.Data;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Services;

/// <summary>
/// Authoritative recalculation pipeline.
/// Every insert, update, or delete of food/activity triggers this.
/// The database stores the OFFICIAL calculated state after this runs.
/// </summary>
public class RecalculationService : IRecalculationService
{
    private readonly AppDbContext _db;

    public RecalculationService(AppDbContext db)
    {
        _db = db;
    }

    public Task RecalculateFullPipelineAsync(long dailyLogId)
        => RecalculateFullPipelineAsync(dailyLogId, cascade: true, siblingBalances: null);

    private async Task RecalculateFullPipelineAsync(long dailyLogId, bool cascade, IReadOnlyDictionary<long, decimal>? siblingBalances)
    {
        // ── Step 1: Load DailyLog with all children ──
        var log = await _db.DailyLogs
            .Include(d => d.FoodEntries)
            .Include(d => d.ActivityEntries)
            .FirstOrDefaultAsync(d => d.DailyLogId == dailyLogId)
            ?? throw new InvalidOperationException("DailyLog not found.");

        // ── Step 2: Recompute food intake totals ──
        log.TotalFoodCaloriesKcal = log.FoodEntries.Sum(f => f.CaloriesKcal);
        log.TotalProteinGrams = log.FoodEntries.Sum(f => f.ProteinGrams);
        log.TotalFatGrams = log.FoodEntries.Sum(f => f.FatGrams);
        log.TotalCarbsGrams = log.FoodEntries.Sum(f => f.CarbsGrams);
        log.TotalAlcoholGrams = log.FoodEntries.Sum(f => f.AlcoholGrams);

        // ── Step 3: Recompute activity totals ──
        log.TotalActivityCaloriesKcal = log.ActivityEntries.Sum(a => a.CalculatedCaloriesKcal);

        // ── Step 3b: Recompute idle-time expenditure (unregistered hours) ──
        var totalActivityMinutes = log.ActivityEntries.Sum(a => a.DurationMinutes ?? 0m);
        var totalActivityHours = totalActivityMinutes / 60m;
        // Sleep & NEAT hours reduce idle time (NULL = log predates the feature; treat as 0)
        var sleepH = log.SnapshotSleepHours ?? 0m;
        var neatH  = log.SnapshotNeatHours  ?? 0m;
        var totalKnownHours = totalActivityHours + sleepH + neatH;
        log.HoursRemainingInDay = Math.Max(0m, 24m - totalKnownHours);
        // Idle MET 1.2 minus 1 MET (resting component already in BMR) = 0.2 net
        log.IdleTimeCaloriesKcal = (1.2m - 1m) * log.SnapshotWeightKg * log.HoursRemainingInDay;
        // Sleep & NEAT calories: (MET - 1) × weight × hours  (same formula as ActivityEntry)
        // MET constants: Sleep = 0.9, NEAT = 3.0 (not user-configurable)
        // Skipped when snapshots are NULL so old daily logs are never retroactively changed.
        log.SleepCaloriesKcal = log.SnapshotSleepHours.HasValue
            ? (0.9m - 1m) * log.SnapshotWeightKg * sleepH
            : 0m;
        log.NeatCaloriesKcal = log.SnapshotNeatHours.HasValue
            ? (3.0m - 1m) * log.SnapshotWeightKg * neatH
            : 0m;

        // ── Step 4: Recompute TEF (per-macro business logic) ──
        log.TEFKcal = TefConstants.Calculate(
            log.TotalProteinGrams,
            log.TotalFatGrams,
            log.TotalCarbsGrams,
            log.TotalAlcoholGrams);

        // ── Step 5: Recompute total daily expenditure ──
        log.TotalDailyExpenditureKcal = log.SnapshotBMRKcal
            + log.TotalActivityCaloriesKcal
            + log.IdleTimeCaloriesKcal
            + log.SleepCaloriesKcal
            + log.NeatCaloriesKcal
            + log.TEFKcal;

        // ── Step 6: Recompute net balance ──
        log.NetBalanceKcal = log.TotalFoodCaloriesKcal - log.TotalDailyExpenditureKcal;

        // ── Step 7: Recompute daily remaining (calories + protein) ──
        log.DailyGoalDeltaKcal = log.NetBalanceKcal - log.SnapshotDailyBaseGoalKcal;
        log.CaloriesRemainingToDailyTargetKcal =
            (log.TotalDailyExpenditureKcal + log.SnapshotDailyBaseGoalKcal) - log.TotalFoodCaloriesKcal;
        log.ProteinRemainingGrams = log.SnapshotProteinGoalGrams - log.TotalProteinGrams;

        // ── Step 8: Recompute weekly dynamic context ──
        await RecalculateWeeklyContext(log, siblingBalances);

        log.LastRecalculatedAtUtc = DateTime.UtcNow;
        log.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // ── Step 9: Update MonthlySummary ──
        await RecalculateMonthlySummary(log.UserId, log.LogDate.Year, log.LogDate.Month);

        // ── Step 11: Cascade — keep sibling days in the same week in sync ──
        // When a past day changes its NetBalanceKcal, all other days in the week
        // need their weekly-context fields (SuggestedDailyAverageRemainingKcal, etc.)
        // recalculated. Without this, today's "adjusted budget" stays stale after
        // you edit yesterday. cascade=false prevents infinite recursion.
        if (cascade)
        {
            var siblings = await _db.DailyLogs
                .Where(d => d.UserId == log.UserId
                    && d.WeekStartDate == log.WeekStartDate
                    && d.DailyLogId != dailyLogId)
                .Select(d => new { d.DailyLogId, d.NetBalanceKcal })
                .ToListAsync();

            // Build the week-balance snapshot once (primary day just saved above).
            // Each sibling call receives the same snapshot so it can skip the
            // DB round-trip for sibling balances inside RecalculateWeeklyContext.
            var siblingBalancesForCascade = siblings.ToDictionary(
                s => s.DailyLogId,
                s => s.NetBalanceKcal);
            // Include the freshly saved primary day so siblings can see its balance.
            siblingBalancesForCascade[dailyLogId] = log.NetBalanceKcal;

            foreach (var sibling in siblings)
                await RecalculateFullPipelineAsync(sibling.DailyLogId, cascade: false, siblingBalances: siblingBalancesForCascade);
        }
    }

    public async Task RefreshSnapshotAndRecalculateAsync(long userId, DateOnly date)
    {
        var log = await _db.DailyLogs
            .FirstOrDefaultAsync(d => d.UserId == userId && d.LogDate == date);

        if (log is null)
            return; // No log for this date yet — nothing to update.

        var profile = await _db.UserProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (profile is null)
            return;

        // Mirror the snapshot logic used in DailyLogService.GetOrCreateAsync.
        var proteinGoal = profile.ProteinGoalGrams
            ?? (profile.AutoCalculateProteinGoal ? profile.CurrentWeightKg * 2.0m : 0m);

        log.SnapshotWeightKg          = profile.CurrentWeightKg;
        log.SnapshotHeightCm          = profile.HeightCm;
        log.SnapshotBMRKcal           = profile.BMRKcal;
        log.SnapshotBodyFatPercent    = profile.BodyFatPercent;
        log.SnapshotDailyBaseGoalKcal = profile.DailyBaseGoalKcal;
        log.SnapshotProteinGoalGrams  = proteinGoal;
        log.SnapshotSleepHours        = profile.SleepHours;
        log.SnapshotNeatHours         = profile.NeatHours;

        await _db.SaveChangesAsync();

        await RecalculateFullPipelineAsync(log.DailyLogId);
    }

    public async Task RecalculateAfterDayDeletionAsync(long userId, DateOnly deletedDate, DateOnly weekStart, DateOnly weekEnd, decimal baseDailyGoal)
    {
        // Recalculate all remaining days in the same week (updates their weekly context)
        var remainingWeekLogIds = await _db.DailyLogs
            .Where(d => d.UserId == userId && d.LogDate >= weekStart && d.LogDate <= weekEnd)
            .Select(d => d.DailyLogId)
            .ToListAsync();

        foreach (var logId in remainingWeekLogIds)
            await RecalculateFullPipelineAsync(logId, cascade: false, siblingBalances: null);

        // Always recalculate the monthly summary for the deleted date's month
        // (handles cross-month weeks where no remaining days fall in the same month)
        await RecalculateMonthlySummary(userId, deletedDate.Year, deletedDate.Month);
    }

    // ─────────────────────────────────────────────────────
    //  Step 8 — Weekly context fields on the DailyLog itself
    // ─────────────────────────────────────────────────────

    private async Task RecalculateWeeklyContext(DailyLog log, IReadOnlyDictionary<long, decimal>? siblingBalances)
    {
        // Use the pre-fetched balance snapshot when available (cascade path) to avoid
        // an extra DB round-trip per sibling. Fall back to a fresh query otherwise.
        List<decimal> otherBalances;
        int otherCount;
        if (siblingBalances is not null)
        {
            // The snapshot contains ALL week days (including the primary); exclude self.
            var others = siblingBalances
                .Where(kv => kv.Key != log.DailyLogId)
                .Select(kv => kv.Value)
                .ToList();
            otherBalances = others;
            otherCount = others.Count;
        }
        else
        {
            var rows = await _db.DailyLogs
                .Where(d => d.UserId == log.UserId
                    && d.WeekStartDate == log.WeekStartDate
                    && d.DailyLogId != log.DailyLogId)
                .Select(d => d.NetBalanceKcal)
                .ToListAsync();
            otherBalances = rows;
            otherCount = rows.Count;
        }

        var allWeekBalances = otherBalances.Sum() + log.NetBalanceKcal;
        var dayOfWeek = log.LogDate.DayNumber - log.WeekStartDate.DayNumber + 1;
        var daysRemaining = 7 - dayOfWeek;

        log.WeeklyTargetKcal = log.SnapshotDailyBaseGoalKcal * 7;
        log.WeeklyExpectedToDateKcal = log.SnapshotDailyBaseGoalKcal * dayOfWeek;
        log.WeeklyActualToDateKcal = allWeekBalances;
        log.WeeklyDifferenceKcal = log.WeeklyActualToDateKcal - log.WeeklyExpectedToDateKcal;
        log.WeeklyRemainingTargetKcal = log.WeeklyTargetKcal - log.WeeklyActualToDateKcal;

        // Use only completed past days for the suggested average so that
        // today's incomplete balance doesn't distort the suggestion, and
        // today itself counts as one of the remaining days to plan for.
        var pastDaysBalance = otherBalances.Sum();
        var pastDaysCount = otherCount;
        var daysRemainingIncludingToday = 7 - pastDaysCount;

        var rawSuggested = daysRemainingIncludingToday > 0
            ? (log.WeeklyTargetKcal - pastDaysBalance) / daysRemainingIncludingToday
            : log.SnapshotDailyBaseGoalKcal;

        // ── Safety floor — never suggest eating below physiologically safe intake ──
        // BiologicalSex is not snapshotted on DailyLog (effectively immutable),
        // so we do a single lightweight SELECT from the user's profile.
        var biologicalSex = await _db.UserProfiles
            .Where(p => p.UserId == log.UserId)
            .Select(p => p.BiologicalSex)
            .FirstOrDefaultAsync();

        var minIntakeKcal = CalculateMinimumDailyIntakeKcal(log, biologicalSex);
        // Convert intake floor → net-balance floor (SuggestedDailyAverageRemainingKcal is
        // a net-balance target: negative = deficit, positive = surplus vs. expenditure)
        var minNetBalance = minIntakeKcal - log.TotalDailyExpenditureKcal;

        // Only set the adjusted goal for today or for a past day that has never had one
        // set before (i.e. its first-ever calculation, indicated by the DB default of 0).
        // Past days that already have a value must keep it frozen — their adjusted budget
        // reflected the week's reality at that point in time and must not be retroactively
        // rewritten when food or activities are changed on any day in the same week.
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var isPastDay = log.LogDate < today;
        var alreadySet = log.SuggestedDailyAverageRemainingKcal != 0m;

        if (!isPastDay || !alreadySet)
            log.SuggestedDailyAverageRemainingKcal = Math.Max(rawSuggested, minNetBalance);
    }

    /// <summary>
    /// Calculates the minimum safe daily calorie intake for a given day using three floors,
    /// returning the highest (most protective) of the three:
    ///
    ///  1. Sex-based absolute floor (1 200 kcal / female, 1 500 kcal / male) — widely cited
    ///     lower bound below which intake should only occur under medical supervision.
    ///
    ///  2. Energy-availability floor — 30 kcal per kg of fat-free mass plus that day's
    ///     exercise calories. Below ~30 kcal/kg FFM the body may enter low-energy-availability
    ///     (LEA), impairing hormonal and physiological function.
    ///     Falls back to full BMR when body-fat % is unavailable.
    ///
    ///  3. BMR safety floor — 80 % of the snapshotted BMR. Prevents absurd suggestions
    ///     for people whose BMR is high enough to make the sex floor alone too permissive.
    /// </summary>
    private static decimal CalculateMinimumDailyIntakeKcal(DailyLog log, string? biologicalSex)
    {
        // 1. Sex-based absolute floor
        var sexFloor = biologicalSex == "F" ? 1200m : 1500m;

        // 2. BMR safety floor
        var bmrFloor = log.SnapshotBMRKcal * 0.8m;

        // 3. Energy-availability floor (requires body-fat % to compute FFM)
        decimal eaFloor;
        if (log.SnapshotBodyFatPercent is > 0)
        {
            var ffmKg = log.SnapshotWeightKg * (1m - log.SnapshotBodyFatPercent.Value / 100m);
            eaFloor = 30m * ffmKg + log.TotalActivityCaloriesKcal;
        }
        else
        {
            // Body fat unknown — fall back to full BMR so we still protect against
            // dangerously low suggestions even without body-composition data.
            eaFloor = log.SnapshotBMRKcal;
        }

        return Math.Max(sexFloor, Math.Max(eaFloor, bmrFloor));
    }

    // ─────────────────────────────────────────────────────
    //  Step 9 — Persist MonthlySummary (shell record only)
    // ─────────────────────────────────────────────────────

    private async Task RecalculateMonthlySummary(long userId, int year, int month)
    {
        var monthStart = new DateOnly(year, month, 1);
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);

        var summary = await _db.MonthlySummaries
            .FirstOrDefaultAsync(m => m.UserId == userId && m.YearNumber == year && m.MonthNumber == month);

        if (summary is null)
        {
            summary = new MonthlySummary
            {
                UserId = userId,
                YearNumber = year,
                MonthNumber = month,
                MonthStartDate = monthStart,
                MonthEndDate = monthEnd
            };
            _db.MonthlySummaries.Add(summary);
        }

        summary.MonthStartDate = monthStart;
        summary.MonthEndDate = monthEnd;
        summary.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();
    }
}
