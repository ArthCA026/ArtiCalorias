namespace Articalorias.DTOs.DailyLogs;

public class DailyLogResponse
{
    // Identidad
    public long DailyLogId { get; set; }
    public DateOnly LogDate { get; set; }

    // Ingesta
    public decimal TotalFoodCaloriesKcal { get; set; }
    public decimal TotalProteinGrams { get; set; }
    public decimal TotalFatGrams { get; set; }
    public decimal TotalCarbsGrams { get; set; }
    public decimal TotalAlcoholGrams { get; set; }
    /// <summary>Null = no entry of the day carried sugar data (not tracked then).</summary>
    public decimal? TotalSugarGrams { get; set; }
    /// <summary>Null = no entry of the day carried water data (not tracked then).</summary>
    public decimal? TotalWaterMl { get; set; }

    /// <summary>Extended macro targets frozen on this day (empty = only protein was tracked).</summary>
    public List<DayMacroTargetResponse> MacroTargets { get; set; } = [];

    // Gasto
    public decimal TotalDailyExpenditureKcal { get; set; }

    // Balance
    public decimal DailyGoalDeltaKcal { get; set; }
    public decimal CaloriesRemainingToDailyTargetKcal { get; set; }
    public decimal ProteinRemainingGrams { get; set; }
    public decimal SuggestedDailyAverageRemainingKcal { get; set; }

    // Snapshot usado
    public decimal SnapshotProteinGoalGrams { get; set; }
    public decimal SnapshotDailyBaseGoalKcal { get; set; }

    // Estado
    /// <summary>User explicitly marked this day as a deliberate fast.</summary>
    public bool IsFastingDay { get; set; }

    // Availability flags — false when body metrics were absent at log creation
    public bool HasCalorieBudgetEstimate { get; set; }
}
