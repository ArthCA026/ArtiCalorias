using Articalorias.Configuration;
using Articalorias.Data;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Articalorias.Services.Macros;
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
        decimal? SnapshotHeightCm,
        decimal TotalFoodCaloriesKcal,
        bool IsFastingDay)
    {
        public bool HasCalorieBudgetEstimate => SnapshotWeightKg.HasValue && SnapshotHeightCm.HasValue;

        /// <summary>
        /// Same rule as the UI and the streak: a day counts as logged once food
        /// is on it, or when the user explicitly marked it a fasting day. A day
        /// row can exist with nothing eaten on it (created by merely opening the
        /// app); without the fasting mark such a day says nothing about intake.
        /// </summary>
        public bool IsLogged => TotalFoodCaloriesKcal > 0m || IsFastingDay;
    }

    public RecalculationService(AppDbContext db)
    {
        _db = db;
    }

    public Task RecalculateFullPipelineAsync(long dailyLogId)
        => RecalculateFullPipelineAsync(dailyLogId, cascade: true, siblingData: null);

    /// <summary>
    /// Full pipeline with the user's local date as the freeze reference. Needed
    /// whenever the recalculation must be able to update TODAY's adjusted budget
    /// (e.g. marking a past day as fasting): with the server UTC clock alone, a
    /// user behind UTC in the evening would have their real today treated as a
    /// frozen past day and the newly banked balance would never reach it.
    /// </summary>
    public Task RecalculateFullPipelineAsync(long dailyLogId, DateOnly referenceToday)
        => RecalculateFullPipelineAsync(dailyLogId, cascade: true, siblingData: null, referenceToday);

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
            .Select(p => new { p.BiologicalSex, p.MinCaloriesSafeguardEnabled, p.TimeZoneId })
            .FirstOrDefaultAsync();
        var biologicalSex = profileData?.BiologicalSex;
        var safeguardEnabled = profileData?.MinCaloriesSafeguardEnabled ?? true;

        // Resolve the freeze reference ("what date is TODAY?") on the USER's
        // calendar, never the server's UTC clock. For a user behind UTC, UTC
        // flips to tomorrow in their late afternoon; with UTC as the reference
        // their real today matched the frozen-past-day rule in Step 8, so
        // editing a finished day (or even normal evening logging) silently
        // stopped updating today's weekly-adjusted budget. Callers that know
        // the client's exact local date (fasting, refresh-snapshot) still pass
        // it in and win over this fallback.
        referenceToday ??= LocalDates.TodayFor(profileData?.TimeZoneId);

        // ── Step 2: Recompute food intake totals ──
        log.TotalFoodCaloriesKcal = log.FoodEntries.Sum(f => f.CaloriesKcal);

        // Macro totals keep the absent/number distinction per key: a key is
        // missing when no entry of the day carried it (macro not tracked back
        // then), while a number — even 0 on a day with entries that tracked
        // it — is a real measurement. Partial days sum whatever entries do
        // carry. Core macros are always present.
        log.MacroTotals = MacroAmounts.Sum(log.FoodEntries.Select(f => f.Macros)).EnsureCore();

        // A fasting day with food on it is a contradiction: the user broke the
        // fast or mislabeled the day. Enforced here, at the single point every
        // food-mutation path funnels through (manual, batch, routine quick-add),
        // so the flag can never coexist with intake. Deleting the food later
        // does NOT re-mark the day.
        if (log.TotalFoodCaloriesKcal > 0m && log.IsFastingDay)
            log.IsFastingDay = false;

        // ── Step 3: Recompute activity totals ──
        // Entry calories are GROSS (MET × weight × hours): they already contain the
        // resting burn of their timeframe, exactly like a smart watch reports it.
        log.TotalActivityCaloriesKcal = log.ActivityEntries.Sum(a => a.CalculatedCaloriesKcal);

        // Resting share inside those gross figures, priced at the MET reference rate
        // (1 kcal/kg/h). Subtracted from the BMR line in Step 5 so the BMR only covers
        // the hours of the day without logged activities and nothing is counted twice.
        // Every block is rounded to the two decimals the day stores BEFORE it
        // is summed, so the burn breakdown the app shows adds up to the stored
        // total exactly instead of drifting by a cent per block.
        var totalActivityMinutes = log.ActivityEntries.Sum(a => a.DurationMinutes ?? 0m);
        var activityRestingOffsetKcal = Round2(ActivityCalorieMath.RestingOffset(
            log.SnapshotWeightKg ?? 0m, totalActivityMinutes));

        // ── Step 3b: Fit the day's hours and price the non-activity blocks ──
        // Activities keep their logged hours, then sleep, then everyday movement
        // (NEAT); whatever is left is idle awake time, so the priced hours never
        // exceed 24 even when the profile hours grew after activities were logged.
        // Sleep/NEAT snapshots are NULL on days that predate the feature: those
        // blocks are skipped and their hours stay idle, so old days never change.
        // Each block contributes only its delta from resting (MET - 1); the
        // resting share is already inside the BMR line of Step 5. Constants and
        // formulas live in ExpenditureModel, shared with the budget estimate.
        // Weight ?? 0m: when weight is absent all MET-based calorie burns are 0.
        var weightKg = log.SnapshotWeightKg ?? 0m;
        var hours = ExpenditureModel.FitDay(log.SnapshotSleepHours, log.SnapshotNeatHours, totalActivityMinutes);
        log.HoursRemainingInDay = hours.IdleHours;
        log.IdleTimeCaloriesKcal = Round2(ExpenditureModel.IdleDeltaKcal(weightKg, hours.IdleHours));
        log.SleepCaloriesKcal = hours.SleepHours.HasValue
            ? Round2(ExpenditureModel.SleepDeltaKcal(weightKg, hours.SleepHours.Value))
            : 0m;
        log.NeatCaloriesKcal = hours.NeatHours.HasValue
            ? Round2(ExpenditureModel.NeatDeltaKcal(weightKg, hours.NeatHours.Value))
            : 0m;

        // ── Step 4: Recompute TEF ──
        // Priced per ENTRY and anchored on each entry's calories (the catalog
        // rates decide how much, the calories decide of what): calories logged
        // without macros still earn a typical TEF, and a macro typo can never
        // earn more than its food could carry. See MacroTef.
        log.TEFKcal = MacroTef.ForDay(log.FoodEntries.Select(f => (f.CaloriesKcal, f.Macros)));

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

        // ── Step 7: Recompute daily remaining calories (macro remaining is derived by the UI from the day's frozen targets) ──
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
                    d.SnapshotHeightCm,
                    d.TotalFoodCaloriesKcal,
                    d.IsFastingDay
                })
                .ToListAsync();

            // Build the week snapshot once (primary day just saved above).
            // Each sibling call receives the same snapshot so it can skip the
            // DB round-trip inside RecalculateWeeklyContext. The snapshot now
            // also carries goal-snapshots and log-dates so the callee can compute
            // mixed-goal weekly targets when the user changed their goal mid-week.
            var siblingDataForCascade = siblings.ToDictionary(
                s => s.DailyLogId,
                s => new SiblingDayData(s.NetBalanceKcal, s.SnapshotDailyBaseGoalKcal, s.LogDate, s.SnapshotWeightKg, s.SnapshotHeightCm, s.TotalFoodCaloriesKcal, s.IsFastingDay));
            // Include the freshly saved primary day so siblings see its values.
            siblingDataForCascade[dailyLogId] = new SiblingDayData(
                log.NetBalanceKcal, log.SnapshotDailyBaseGoalKcal, log.LogDate, log.SnapshotWeightKg, log.SnapshotHeightCm, log.TotalFoodCaloriesKcal, log.IsFastingDay);

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
        log.SnapshotWeightKg          = profile.CurrentWeightKg;
        log.SnapshotHeightCm          = profile.HeightCm;
        log.SnapshotBMRKcal           = profile.BMRKcal;
        log.SnapshotBodyFatPercent    = profile.BodyFatPercent;
        log.SnapshotDailyBaseGoalKcal = profile.DailyBaseGoalKcal;
        log.SnapshotSleepHours        = profile.SleepHours;
        log.SnapshotNeatHours         = profile.NeatHours;

        // Refreshing a snapshot re-freezes every macro target (protein
        // included), so "apply from today" after changing tracked macros uses
        // the same mechanism as sleep/NEAT changes. Past days are never
        // refreshed by the UI, so their frozen targets stay historically true.
        var macroPrefs = await _db.UserMacroPreferences
            .AsNoTracking()
            .Where(m => m.UserId == userId)
            .ToListAsync();
        log.MacroTargetsJson = MacroTargetEngine.BuildJson(profile, macroPrefs);

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

    public async Task<(int Repriced, int Failed)> RepriceAllDaysAsync(CancellationToken ct = default)
    {
        var weeks = await _db.DailyLogs
            .AsNoTracking()
            .GroupBy(d => new { d.UserId, d.WeekStartDate })
            .Select(g => new { g.Key.UserId, g.Key.WeekStartDate })
            .OrderBy(w => w.UserId).ThenBy(w => w.WeekStartDate)
            .ToListAsync(ct);

        var repriced = 0;
        var failed = 0;

        foreach (var week in weeks)
        {
            ct.ThrowIfCancellationRequested();

            var dayIds = await _db.DailyLogs
                .AsNoTracking()
                .Where(d => d.UserId == week.UserId && d.WeekStartDate == week.WeekStartDate)
                .OrderBy(d => d.LogDate)
                .Select(d => d.DailyLogId)
                .ToListAsync(ct);

            try
            {
                // Pass 1 gives every day of the week its new net balance. Pass 2
                // is one cascading run from the last day: each sibling then
                // rebuilds its weekly context from the week's FINAL balances
                // instead of a mix of old and new ones.
                foreach (var id in dayIds)
                    await RecalculateFullPipelineAsync(id, cascade: false, siblingData: null);
                if (dayIds.Count > 1)
                    await RecalculateFullPipelineAsync(dayIds[^1], cascade: true, siblingData: null);

                repriced += dayIds.Count;
            }
            catch (Exception ex) when (ex is DbUpdateException or InvalidOperationException)
            {
                // The user edited the day at the same moment (row version), or
                // it was deleted under us. Their own edit already re-priced
                // what it touched; the caller retries the rest on next start.
                failed += dayIds.Count;
            }
            finally
            {
                // One context serves the whole run: without this it would end
                // up tracking every day and entry in the database.
                _db.ChangeTracker.Clear();
            }
        }

        return (repriced, failed);
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
                .Select(d => new SiblingDayData(d.NetBalanceKcal, d.SnapshotDailyBaseGoalKcal, d.LogDate, d.SnapshotWeightKg, d.SnapshotHeightCm, d.TotalFoodCaloriesKcal, d.IsFastingDay))
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

        // ── Suggested daily budget: bank only what was actually logged ──────────
        // Only past days with food logged AND a calorie budget estimate may bank a
        // deficit or surplus. An empty day row (created by merely opening the app)
        // has NetBalance = -TDEE, and counting that as "banked" would hand the rest
        // of the week a phantom budget of a whole day's expenditure — the user did
        // not undereat, they just did not log. Every other past day (unlogged,
        // missing row, or lacking body metrics) is assumed ON PLAN: it contributes
        // its own goal, which cancels out of the average exactly as if the week
        // were that many days shorter.
        //
        // Remaining days come from the calendar, not from row counts: a past day
        // with no row is elapsed time, never a day still available to plan for.
        var pastDays = others.Where(o => o.LogDate < log.LogDate).ToList();
        var bankedKcal = pastDays.Sum(o =>
            o.IsLogged && o.HasCalorieBudgetEstimate
                ? o.NetBalanceKcal
                : o.SnapshotDailyBaseGoalKcal);

        // Elapsed week days with no row at all: assumed on plan at today's goal.
        var daysElapsedBeforeToday = Math.Clamp(log.LogDate.DayNumber - log.WeekStartDate.DayNumber, 0, 6);
        var missingPastDays = Math.Max(daysElapsedBeforeToday - pastDays.Count, 0);
        bankedKcal += missingPastDays * log.SnapshotDailyBaseGoalKcal;

        // Today always counts as one of the remaining days to plan for (>= 1).
        var daysRemainingIncludingToday = 7 - daysElapsedBeforeToday;

        var rawSuggested = (log.WeeklyTargetKcal - bankedKcal) / daysRemainingIncludingToday;

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
        // referenceToday is always resolved by the pipeline (client date when the
        // endpoint knows it, profile timezone otherwise); UTC is a last resort only.
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

    private static decimal Round2(decimal value) => Math.Round(value, 2);

    /// <summary>
    /// The day's minimum safe intake (see <see cref="IntakeSafeguard"/> for the
    /// three floors), from the day's own snapshots and its exercise calories
    /// above resting: energy availability is defined against the ADDITIONAL
    /// cost of exercise, so the resting share inside the gross activity
    /// figures is removed again here.
    /// </summary>
    private static decimal CalculateMinimumDailyIntakeKcal(DailyLog log, string? biologicalSex, decimal activityRestingOffsetKcal)
        => IntakeSafeguard.MinimumDailyIntakeKcal(
            biologicalSex,
            log.SnapshotBMRKcal,
            log.SnapshotWeightKg,
            log.SnapshotBodyFatPercent,
            exerciseKcalAboveResting: log.TotalActivityCaloriesKcal - activityRestingOffsetKcal);

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
