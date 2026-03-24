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
}
