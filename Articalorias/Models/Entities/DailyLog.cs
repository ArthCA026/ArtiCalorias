namespace Articalorias.Models.Entities;

public class DailyLog
{
    public long DailyLogId { get; set; }
    public long UserId { get; set; }
    public DateOnly LogDate { get; set; }

    // Snapshot del perfil usado ese día
    public decimal SnapshotWeightKg { get; set; }
    public decimal SnapshotHeightCm { get; set; }
    public decimal SnapshotBMRKcal { get; set; }
    public decimal? SnapshotBodyFatPercent { get; set; }
    public decimal SnapshotDailyBaseGoalKcal { get; set; }
    public decimal SnapshotProteinGoalGrams { get; set; }

    // Ingesta total del día
    public decimal TotalFoodCaloriesKcal { get; set; }
    public decimal TotalProteinGrams { get; set; }
    public decimal TotalFatGrams { get; set; }
    public decimal TotalCarbsGrams { get; set; }
    public decimal TotalAlcoholGrams { get; set; }

    // Gasto del día
    public decimal TotalActivityCaloriesKcal { get; set; }
    public decimal TEFKcal { get; set; }
    public decimal HoursRemainingInDay { get; set; }
    public decimal IdleTimeCaloriesKcal { get; set; }
    public decimal TotalDailyExpenditureKcal { get; set; }

    // Balance / objetivos
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
    public DateTime? LastRecalculatedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];

    // Navigation
    public User User { get; set; } = null!;
    public ICollection<FoodEntry> FoodEntries { get; set; } = [];
    public ICollection<ActivityEntry> ActivityEntries { get; set; } = [];
}
