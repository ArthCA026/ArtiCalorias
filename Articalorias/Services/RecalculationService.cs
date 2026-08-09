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

    // Carries the per-day fields needed for mixed-goal weekly context and
    // budget-eligibility filtering (requires both weight and height).
    private record SiblingDayData(
        decimal NetBalanceKcal,
        decimal SnapshotDailyBaseGoalKcal,
        DateOnly LogDate,
        decimal? SnapshotWeightKg,
        decimal? SnapshotHeightCm)
    {
        public bool HasCalorieBudgetEstimate => SnapshotWeightKg.HasValue && SnapshotHeightCm.HasValue;
    }

    public RecalculationService(AppDbContext db)
    {
        _db = db;
    }

    public Task RecalculateFullPipelineAsync(long dailyLogId)
        => RecalculateFullPipelineAsync(dailyLogId, cascade: true, siblingData: null);

    private async Task RecalculateFullPipelineAsync(long dailyLogId, bool cascade, IReadOnlyDictionary<long, SiblingDayData>? siblingData, DateOnly? referenceToday = null)
    {
        // ── Step 1: Load DailyLog with all children ──
        var log = await _db.DailyLogs
            .Include(d => d.FoodEntries)
            .Include(d => d.ActivityEntries)
            .FirstOrDefaultAsync(d => d.DailyLogId == dailyLogId)
            ?? throw new InvalidOperationException("DailyLog not found.");

        // ── Step 1b: Load profile settings for safeguard calculations ──
        // Loaded once here so both Step 7 (Daily Goal mode) and Step 8 (Weekly Adjusted
        // mode) share the same values without an extra DB round-trip per step.
        var profileData = await _db.UserProfiles
            .Where(p => p.UserId == log.UserId)
            .Select(p => new { p.BiologicalSex, p.MinCaloriesSafeguardEnabled })
            .FirstOrDefaultAsync();
        var biologicalSex = profileData?.BiologicalSex;
        var safeguardEnabled = profileData?.MinCaloriesSafeguardEnabled ?? true;

        // ── Step 2: Recompute food intake totals ──
        log.TotalFoodCaloriesKcal = log.FoodEntries.Sum(f => f.CaloriesKcal);
        log.TotalProteinGrams = log.FoodEntries.Sum(f => f.ProteinGrams);
        log.TotalFatGrams = log.FoodEntries.Sum(f => f.FatGrams);
        log.TotalCarbsGrams = log.FoodEntries.Sum(f => f.CarbsGrams);
        log.TotalAlcoholGrams = log.FoodEntries.Sum(f => f.AlcoholGrams);

        // ── Step 3: Recompute activity totals ──
        // Entry calories are GROSS (MET × weight × hours): they already contain the
        // resting burn of their timeframe, exactly like a smart watch reports it.
        log.TotalActivityCaloriesKcal = log.ActivityEntries.Sum(a => a.CalculatedCaloriesKcal);

        // Resting share inside those gross figures, priced at the MET reference rate
        // (1 kcal/kg/h). Subtracted from the BMR line in Step 5 so the BMR only covers
        // the hours of the day without logged activities and nothing is counted twice.
        var totalActivityMinutes = log.ActivityEntries.Sum(a => a.DurationMinutes ?? 0m);
        var activityRestingOffsetKcal = ActivityCalorieMath.RestingOffset(
            log.SnapshotWeightKg ?? 0m, totalActivityMinutes);

        // ── Step 3b: Recompute idle-time expenditure (unregistered hours) ──
        var totalActivityHours = totalActivityMinutes / 60m;
        // Sleep & NEAT hours reduce idle time (NULL = log predates the feature; treat as 0)
        var sleepH = log.SnapshotSleepHours ?? 0m;
        var neatH  = log.SnapshotNeatHours  ?? 0m;
        var totalKnownHours = totalActivityHours + sleepH + neatH;
        log.HoursRemainingInDay = Math.Max(0m, 24m - totalKnownHours);
        // Idle MET 1.2 minus 1 MET (resting component already in BMR) = 0.2 net
        // Weight ?? 0m: when weight is absent all MET-based calorie burns are 0.
        log.IdleTimeCaloriesKcal = (1.2m - 1m) * (log.SnapshotWeightKg ?? 0m) * log.HoursRemainingInDay;
        // Sleep & NEAT calories: (MET - 1) × weight × hours  (same formula as ActivityEntry)
        // MET constants: Sleep = 0.9, NEAT = 3.0 (not user-configurable)
        // Skipped when snapshots are NULL so old daily logs are never retroactively changed.
        log.SleepCaloriesKcal = log.SnapshotSleepHours.HasValue
            ? (0.9m - 1m) * (log.SnapshotWeightKg ?? 0m) * sleepH
            : 0m;
        log.NeatCaloriesKcal = log.SnapshotNeatHours.HasValue
            ? (3.0m - 1m) * (log.SnapshotWeightKg ?? 0m) * neatH
            : 0m;

        // ── Step 4: Recompute TEF (per-macro business logic) ──
        log.TEFKcal = TefConstants.Calculate(
            log.TotalProteinGrams,
            log.TotalFatGrams,
            log.TotalCarbsGrams,
            log.TotalAlcoholGrams);

        // ── Step 5: Recompute total daily expenditure ──
        // BMR minus the resting offset = resting energy of the non-activity hours only;
        // activity entries carry their own resting share inside their gross calories.
        log.TotalDailyExpenditureKcal = log.SnapshotBMRKcal
            - activityRestingOffsetKcal
            + log.TotalActivityCaloriesKcal
            + log.IdleTimeCaloriesKcal
            + log.SleepCaloriesKcal
            + log.NeatCaloriesKcal
            + log.TEFKcal;

        // ── Step 6: Recompute net balance ──
        log.NetBalanceKcal = log.TotalFoodCaloriesKcal - log.TotalDailyExpenditureKcal;

        // ── Step 7: Recompute daily remaining (calories + protein) ──
        log.DailyGoalDeltaKcal = log.NetBalanceKcal - log.SnapshotDailyBaseGoalKcal;

        // Apply the same physiological safeguard to the "Daily Goal" calorie mode.
        // rawGoalTarget = TDEE + user's deficit/surplus (e.g. 2000 + (-1100) = 900 kcal
        // for an aggressive -1.00 kg/wk plan — below the 1200/1500 minimum intake floor).
        // Always floor at 1 kcal so the budget is never <= 0 (prevents negative-budget UI bugs).
        var rawGoalTarget = log.TotalDailyExpenditureKcal + log.SnapshotDailyBaseGoalKcal;
        var minIntakeForGoal = CalculateMinimumDailyIntakeKcal(log, biologicalSex, activityRestingOffsetKcal);
        var effectiveGoalTarget = Math.Max(
            rawGoalTarget,
            safeguardEnabled ? Math.Max(minIntakeForGoal, 1m) : 1m);
        log.CaloriesRemainingToDailyTargetKcal = effectiveGoalTarget - log.TotalFoodCaloriesKcal;

        log.ProteinRemainingGrams = log.SnapshotProteinGoalGrams - log.TotalProteinGrams;

        // ── Availability guard — zero budget fields when body metrics are incomplete ──
        // Weight + height are both required for TDEE / BMR auto-calc.
        // Zeroing prevents the UI from displaying misleading "0 of 0 kcal" progress bars.
        // The HasCalorieBudgetEstimate flag (derived in the DTO) tells the frontend
        // to show an informational banner instead of calorie progress data.
        if (!log.SnapshotWeightKg.HasValue || !log.SnapshotHeightCm.HasValue)
        {
            log.NetBalanceKcal = 0m;
            log.DailyGoalDeltaKcal = 0m;
            log.CaloriesRemainingToDailyTargetKcal = 0m;
        }

        // ── Step 8: Recompute weekly dynamic context ──
        await RecalculateWeeklyContext(log, siblingData, biologicalSex, safeguardEnabled, activityRestingOffsetKcal, referenceToday);

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
                .Select(d => new
                {
                    d.DailyLogId,
                    d.NetBalanceKcal,
                    d.SnapshotDailyBaseGoalKcal,
                    d.LogDate,
                    d.SnapshotWeightKg,
                    d.SnapshotHeightCm
                })
                .ToListAsync();

            // Build the week snapshot once (primary day just saved above).
            // Each sibling call receives the same snapshot so it can skip the
            // DB round-trip inside RecalculateWeeklyContext. The snapshot now
            // also carries goal-snapshots and log-dates so the callee can compute
            // mixed-goal weekly targets when the user changed their goal mid-week.
            var siblingDataForCascade = siblings.ToDictionary(
                s => s.DailyLogId,
                s => new SiblingDayData(s.NetBalanceKcal, s.SnapshotDailyBaseGoalKcal, s.LogDate, s.SnapshotWeightKg, s.SnapshotHeightCm));
            // Include the freshly saved primary day so siblings see its values.
            siblingDataForCascade[dailyLogId] = new SiblingDayData(
                log.NetBalanceKcal, log.SnapshotDailyBaseGoalKcal, log.LogDate, log.SnapshotWeightKg, log.SnapshotHeightCm);

            foreach (var sibling in siblings)
                await RecalculateFullPipelineAsync(sibling.DailyLogId, cascade: false, siblingData: siblingDataForCascade, referenceToday: referenceToday);
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
            ?? (profile.AutoCalculateProteinGoal && profile.CurrentWeightKg.HasValue ? profile.CurrentWeightKg.Value * 2.0m : 0m);

        log.SnapshotWeightKg          = profile.CurrentWeightKg;
        log.SnapshotHeightCm          = profile.HeightCm;
        log.SnapshotBMRKcal           = profile.BMRKcal;
        log.SnapshotBodyFatPercent    = profile.BodyFatPercent;
        log.SnapshotDailyBaseGoalKcal = profile.DailyBaseGoalKcal;
        log.SnapshotProteinGoalGrams  = proteinGoal;
        log.SnapshotSleepHours        = profile.SleepHours;
        log.SnapshotNeatHours         = profile.NeatHours;

        await _db.SaveChangesAsync();

        // Pass the caller-supplied date as the reference point so the frozen-past-day
        // guard uses the user's local date instead of the server's UTC clock.
        // Without this, users in UTC-N timezones after ~(24-N):00 local time would see
        // today treated as a past day, causing the adjusted budget to be skipped.
        await RecalculateFullPipelineAsync(log.DailyLogId, cascade: true, siblingData: null, referenceToday: date);
    }

    public async Task<int> RefreshStaleSnapshotsAsync(long userId, CancellationToken ct = default)
    {
        // Only meaningful when the profile already has both weight and height.
        var profile = await _db.UserProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId, ct);

        if (profile is null || !profile.CurrentWeightKg.HasValue || !profile.HeightCm.HasValue)
            return 0;

        // Collect all dates where either snapshot column is still null.
        // This set is naturally small (only logs created before the profile
        // was complete) so no explicit date-window cap is needed.
        var staleDates = await _db.DailyLogs
            .AsNoTracking()
            .Where(d => d.UserId == userId
                     && (d.SnapshotWeightKg == null || d.SnapshotHeightCm == null))
            .Select(d => d.LogDate)
            .ToListAsync(ct);

        foreach (var date in staleDates)
            await RefreshSnapshotAndRecalculateAsync(userId, date);

        return staleDates.Count;
    }

    public async Task RecalculateAfterDayDeletionAsync(long userId, DateOnly deletedDate, DateOnly weekStart, DateOnly weekEnd, decimal baseDailyGoal)
    {
        // Recalculate all remaining days in the same week (updates their weekly context)
        var remainingWeekLogIds = await _db.DailyLogs
            .Where(d => d.UserId == userId && d.LogDate >= weekStart && d.LogDate <= weekEnd)
            .Select(d => d.DailyLogId)
            .ToListAsync();

        foreach (var logId in remainingWeekLogIds)
            await RecalculateFullPipelineAsync(logId, cascade: false, siblingData: null);

        // Always recalculate the monthly summary for the deleted date's month
        // (handles cross-month weeks where no remaining days fall in the same month)
        await RecalculateMonthlySummary(userId, deletedDate.Year, deletedDate.Month);
    }

    // ─────────────────────────────────────────────────────
    //  Step 8 — Weekly context fields on the DailyLog itself
    // ─────────────────────────────────────────────────────

    private async Task RecalculateWeeklyContext(DailyLog log, IReadOnlyDictionary<long, SiblingDayData>? siblingData, string? biologicalSex, bool safeguardEnabled, decimal activityRestingOffsetKcal, DateOnly? referenceToday = null)
    {
        // Use the pre-fetched snapshot when available (cascade path) to avoid
        // an extra DB round-trip per sibling. Fall back to a fresh query otherwise.
        List<SiblingDayData> others;
        if (siblingData is not null)
        {
            // The snapshot contains ALL week days (including the primary); exclude self.
            others = siblingData
                .Where(kv => kv.Key != log.DailyLogId)
                .Select(kv => kv.Value)
                .ToList();
        }
        else
        {
            others = await _db.DailyLogs
                .Where(d => d.UserId == log.UserId
                    && d.WeekStartDate == log.WeekStartDate
                    && d.DailyLogId != log.DailyLogId)
                .Select(d => new SiblingDayData(d.NetBalanceKcal, d.SnapshotDailyBaseGoalKcal, d.LogDate, d.SnapshotWeightKg, d.SnapshotHeightCm))
                .ToListAsync();
        }

        // ── Weekly target: sum each logged day's own goal snapshot ──────────────────────
        // When the user changes their goal mid-week, past days keep their original
        // SnapshotDailyBaseGoalKcal, so summing across all logged days correctly weights
        // each day by the goal that was active at the time.
        // Unlogged future days are estimated using today's current snapshot.
        var loggedGoalSum   = others.Sum(o => o.SnapshotDailyBaseGoalKcal) + log.SnapshotDailyBaseGoalKcal;
        var unloggedDays    = 7 - (others.Count + 1);
        log.WeeklyTargetKcal = loggedGoalSum + unloggedDays * log.SnapshotDailyBaseGoalKcal;

        // ── Weekly expected to date: sum of per-day goals up to and including today ──
        var priorGoalSum             = others.Where(o => o.LogDate < log.LogDate).Sum(o => o.SnapshotDailyBaseGoalKcal);
        log.WeeklyExpectedToDateKcal = priorGoalSum + log.SnapshotDailyBaseGoalKcal;

        log.WeeklyActualToDateKcal    = others.Sum(o => o.NetBalanceKcal) + log.NetBalanceKcal;
        log.WeeklyDifferenceKcal      = log.WeeklyActualToDateKcal - log.WeeklyExpectedToDateKcal;
        log.WeeklyRemainingTargetKcal = log.WeeklyTargetKcal - log.WeeklyActualToDateKcal;

        // Use only completed past days that have a full calorie budget estimate for the
        // suggested average, so days without body metrics don't distort the suggestion.
        // Today itself counts as one of the remaining days to plan for.
        var selfHasBudget   = log.SnapshotWeightKg.HasValue && log.SnapshotHeightCm.HasValue;
        var eligiblePastDays = others
            .Where(o => o.LogDate < log.LogDate && o.HasCalorieBudgetEstimate)
            .ToList();
        var pastDaysBalance = eligiblePastDays.Sum(o => o.NetBalanceKcal)
            + (selfHasBudget ? 0m : 0m); // self already excluded — kept for readability
        var daysRemainingIncludingToday = 7 - others.Count;

        var rawSuggested = daysRemainingIncludingToday > 0
            ? (log.WeeklyTargetKcal - pastDaysBalance) / daysRemainingIncludingToday
            : log.SnapshotDailyBaseGoalKcal;

        // ── Safety floor — never suggest eating below physiologically safe intake ──
        // biologicalSex and safeguardEnabled are loaded once in Step 1b of
        // RecalculateFullPipelineAsync and passed in, avoiding a redundant DB round-trip.
        var minIntakeKcal = CalculateMinimumDailyIntakeKcal(log, biologicalSex, activityRestingOffsetKcal);
        // Convert intake floor → net-balance floor (SuggestedDailyAverageRemainingKcal is
        // a net-balance target: negative = deficit, positive = surplus vs. expenditure)
        var minNetBalance = minIntakeKcal - log.TotalDailyExpenditureKcal;

        // Only set the adjusted goal for today or for a past day that has never had one
        // set before (i.e. its first-ever calculation, indicated by the DB default of 0).
        // Past days that already have a value must keep it frozen — their adjusted budget
        // reflected the week's reality at that point in time and must not be retroactively
        // rewritten when food or activities are changed on any day in the same week.
        // referenceToday is the user's local date supplied by the caller; falls back to
        // the server UTC clock for food/activity saves (where timezone ambiguity is fine).
        var today = referenceToday ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var isPastDay = log.LogDate < today;
        var alreadySet = log.SuggestedDailyAverageRemainingKcal != 0m;

        // Convert "budget >= 1 kcal" into a net-balance floor:
        // adjusted budget = TDEE + SuggestedDailyAverageRemainingKcal, so
        // Suggested >= (1 - TDEE) guarantees budget >= 1 kcal unconditionally.
        // This prevents the "0 of -10 kcal" display bug regardless of safeguard state.
        var minNetBalanceForDisplay = 1m - log.TotalDailyExpenditureKcal;

        if (!isPastDay || !alreadySet)
            log.SuggestedDailyAverageRemainingKcal = Math.Max(
                safeguardEnabled ? Math.Max(rawSuggested, minNetBalance) : rawSuggested,
                minNetBalanceForDisplay);
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
    private static decimal CalculateMinimumDailyIntakeKcal(DailyLog log, string? biologicalSex, decimal activityRestingOffsetKcal)
    {
        // 1. Sex-based absolute floor
        var sexFloor = biologicalSex == "F" ? 1200m : 1500m;

        // 2. BMR safety floor
        var bmrFloor = log.SnapshotBMRKcal * 0.8m;

        // 3. Energy-availability floor (requires body-fat % to compute FFM)
        decimal eaFloor;
        if (log.SnapshotBodyFatPercent is > 0 && log.SnapshotWeightKg.HasValue)
        {
            var ffmKg = log.SnapshotWeightKg.Value * (1m - log.SnapshotBodyFatPercent.Value / 100m);
            // EA is defined against the ADDITIONAL cost of exercise, so the resting
            // share inside the gross activity figures is removed again here. This
            // keeps the floor identical to what it was under the net convention.
            eaFloor = 30m * ffmKg + (log.TotalActivityCaloriesKcal - activityRestingOffsetKcal);
        }
        else
        {
            // Body fat or weight unknown — fall back to full BMR so we still protect against
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
