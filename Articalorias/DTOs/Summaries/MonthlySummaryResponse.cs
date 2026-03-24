namespace Articalorias.DTOs.Summaries;

public class MonthlySummaryResponse
{
    public long MonthlySummaryId { get; set; }
    public int YearNumber { get; set; }
    public int MonthNumber { get; set; }

    public decimal TotalFoodCaloriesKcal { get; set; }
    public decimal TotalProteinGrams { get; set; }
    public decimal TotalActivityCaloriesKcal { get; set; }
    public decimal TotalTEFKcal { get; set; }
    public decimal TotalExpenditureKcal { get; set; }
    public decimal ActualMonthlyBalanceKcal { get; set; }

    public decimal AverageDailyFoodCaloriesKcal { get; set; }
    public decimal AverageDailyExpenditureKcal { get; set; }
    public decimal AverageDailyBalanceKcal { get; set; }
    public decimal AverageWeeklyBalanceKcal { get; set; }

    public decimal? EstimatedWeightChangeKg { get; set; }
    public int DaysLogged { get; set; }
}
