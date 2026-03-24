namespace Articalorias.DTOs.Summaries;

public class WeeklySummaryResponse
{
    public long WeeklySummaryId { get; set; }
    public DateOnly WeekStartDate { get; set; }
    public DateOnly WeekEndDate { get; set; }

    public decimal BaseDailyGoalKcalUsed { get; set; }
    public decimal ExpectedWeeklyTargetKcal { get; set; }

    public decimal TotalFoodCaloriesKcal { get; set; }
    public decimal TotalProteinGrams { get; set; }
    public decimal TotalActivityCaloriesKcal { get; set; }
    public decimal TotalTEFKcal { get; set; }
    public decimal TotalExpenditureKcal { get; set; }

    public decimal ActualWeeklyBalanceKcal { get; set; }
    public decimal DifferenceVsTargetKcal { get; set; }
    public decimal RemainingTargetKcal { get; set; }
    public decimal RequiredDailyAverageRemainingKcal { get; set; }

    public int DaysLogged { get; set; }
    public decimal? EstimatedWeightChangeKg { get; set; }
}
