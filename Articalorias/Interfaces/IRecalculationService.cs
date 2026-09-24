namespace Articalorias.Interfaces;

/// <summary>
/// The authoritative recalculation pipeline.
/// Every food or activity change MUST flow through this service.
/// This is the single entry point that guarantees the database
/// reflects the official calculated state.
/// </summary>
public interface IRecalculationService
{
    /// <summary>
    /// Runs the full 10-step recalculation pipeline:
    /// 1.  Load DailyLog with all children
    /// 2.  Recompute food intake totals
    /// 3.  Recompute activity totals
    /// 4.  Recompute TEF
    /// 5.  Recompute total daily expenditure
    /// 6.  Recompute net balance
    /// 7.  Recompute daily remaining (calories + protein)
    /// 8.  Recompute weekly dynamic context
    /// 9.  Update WeeklySummary
    /// 10. Update MonthlySummary
    /// </summary>
    Task RecalculateFullPipelineAsync(long dailyLogId);

    /// <summary>
    /// Same pipeline, but with the user's local date as the past-day freeze
    /// reference. Required whenever the recalculation must be able to update
    /// today's adjusted budget for users whose local date lags the server's
    /// UTC date (e.g. marking a past day as a fasting day in the evening).
    /// </summary>
    Task RecalculateFullPipelineAsync(long dailyLogId, DateOnly referenceToday);

    /// <summary>
    /// Updates all profile snapshot fields on the daily log for <paramref name="date"/>
    /// from the user's current profile, then runs the full recalculation pipeline.
    /// A no-op if no log exists for that date yet.
    /// </summary>
    Task RefreshSnapshotAndRecalculateAsync(long userId, DateOnly date);

    /// <summary>
    /// Refreshes profile snapshots and recalculates every DailyLog whose
    /// <c>SnapshotWeightKg</c> or <c>SnapshotHeightCm</c> is null, provided the
    /// user's current profile now has both values.
    /// Typical use: called after a profile save that fills in previously-missing
    /// weight or height so that historical entries stop showing "Missing profile
    /// details".
    /// </summary>
    /// <returns>Number of daily logs that were refreshed.</returns>
    Task<int> RefreshStaleSnapshotsAsync(long userId, CancellationToken ct = default);

    /// <summary>
    /// Recalculates weekly and monthly summaries after a day has been deleted.
    /// Updates weekly context on remaining sibling days, then refreshes
    /// the WeeklySummary and MonthlySummary aggregates.
    /// </summary>
    Task RecalculateAfterDayDeletionAsync(long userId, DateOnly deletedDate, DateOnly weekStart, DateOnly weekEnd, decimal baseDailyGoal);

    /// <summary>
    /// Re-prices EVERY stored day with the current calculation rules, week by
    /// week. Used once per change of the rules themselves (a TEF rate, the
    /// TEF reconciliation): those are code, not per-day snapshots, so without
    /// this a day would only pick them up the next time it happened to be
    /// touched and history would sit half old, half new. Inputs are never
    /// changed: snapshots, entries and frozen past-day adjusted budgets stay
    /// exactly as they are.
    /// </summary>
    /// <returns>Days re-priced, and days that failed and still carry the old figures.</returns>
    Task<(int Repriced, int Failed)> RepriceAllDaysAsync(CancellationToken ct = default);
}
