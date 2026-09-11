namespace Articalorias.DTOs.DailyLogs;

public class DailyLogResponse
{
    // Identidad
    public long DailyLogId { get; set; }
    public DateOnly LogDate { get; set; }

    // Ingesta
    public decimal TotalFoodCaloriesKcal { get; set; }

    /// <summary>
    /// Consumed amounts keyed by catalog macro key. Absent key = no entry of
    /// the day carried it (the macro was not tracked then); core macros are
    /// always present.
    /// </summary>
    public Dictionary<string, decimal> MacroTotals { get; set; } = new();

    /// <summary>Every macro target frozen on this day, protein included, in catalog order. Empty = nothing tracked that day.</summary>
    public List<DayMacroTargetResponse> MacroTargets { get; set; } = [];

    // Gasto
    public decimal TotalDailyExpenditureKcal { get; set; }

    // Balance
    public decimal DailyGoalDeltaKcal { get; set; }
    public decimal CaloriesRemainingToDailyTargetKcal { get; set; }
    public decimal SuggestedDailyAverageRemainingKcal { get; set; }

    // Snapshot usado
    public decimal SnapshotDailyBaseGoalKcal { get; set; }

    // Estado
    /// <summary>User explicitly marked this day as a deliberate fast.</summary>
    public bool IsFastingDay { get; set; }

    // Availability flags — false when body metrics were absent at log creation
    public bool HasCalorieBudgetEstimate { get; set; }
}
