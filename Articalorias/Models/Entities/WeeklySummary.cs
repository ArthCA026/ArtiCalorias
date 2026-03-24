namespace Articalorias.Models.Entities;

public class WeeklySummary
{
    public long WeeklySummaryId { get; set; }
    public long UserId { get; set; }
    public DateOnly WeekStartDate { get; set; }
    public DateOnly WeekEndDate { get; set; }

    public decimal BaseDailyGoalKcalUsed { get; set; }
    public decimal ExpectedWeeklyTargetKcal { get; set; }

    public decimal TotalFoodCaloriesKcal { get; set; }
    public decimal TotalProteinGrams { get; set; }
    public decimal TotalFatGrams { get; set; }
    public decimal TotalCarbsGrams { get; set; }
    public decimal TotalAlcoholGrams { get; set; }

    public decimal TotalActivityCaloriesKcal { get; set; }
    public decimal TotalTEFKcal { get; set; }
    public decimal TotalExpenditureKcal { get; set; }

    public decimal ActualWeeklyBalanceKcal { get; set; }
    public decimal DifferenceVsTargetKcal { get; set; }
    public decimal RemainingTargetKcal { get; set; }
    public decimal RequiredDailyAverageRemainingKcal { get; set; }

    public int DaysLogged { get; set; }
    public decimal? EstimatedWeightChangeKg { get; set; }

    public DateTime LastCalculatedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];

    // Navigation
    public User User { get; set; } = null!;
}
