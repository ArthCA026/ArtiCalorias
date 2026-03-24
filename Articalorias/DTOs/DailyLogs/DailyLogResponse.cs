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

    // Gasto
    public decimal TotalActivityCaloriesKcal { get; set; }
    public decimal TEFKcal { get; set; }
    public decimal HoursRemainingInDay { get; set; }
    public decimal IdleTimeCaloriesKcal { get; set; }
    public decimal TotalDailyExpenditureKcal { get; set; }

    // Balance
    public decimal NetBalanceKcal { get; set; }
    public decimal DailyGoalDeltaKcal { get; set; }
    public decimal CaloriesRemainingToDailyTargetKcal { get; set; }
    public decimal ProteinRemainingGrams { get; set; }

    // Contexto semanal
    public DateOnly WeekStartDate { get; set; }
    public DateOnly WeekEndDate { get; set; }
    public decimal WeeklyTargetKcal { get; set; }
    public decimal WeeklyActualToDateKcal { get; set; }
    public decimal WeeklyExpectedToDateKcal { get; set; }
    public decimal WeeklyDifferenceKcal { get; set; }
    public decimal WeeklyRemainingTargetKcal { get; set; }
    public decimal SuggestedDailyAverageRemainingKcal { get; set; }

    // Estado
    public bool IsFinalized { get; set; }

    // Snapshot usado
    public decimal SnapshotWeightKg { get; set; }
    public decimal SnapshotHeightCm { get; set; }
    public decimal SnapshotBMRKcal { get; set; }
    public decimal? SnapshotBodyFatPercent { get; set; }
    public decimal SnapshotDailyBaseGoalKcal { get; set; }
    public decimal SnapshotProteinGoalGrams { get; set; }
}
