namespace Articalorias.Models.Entities;

public class MonthlySummary
{
    public long MonthlySummaryId { get; set; }
    public long UserId { get; set; }
    public int YearNumber { get; set; }
    public int MonthNumber { get; set; }
    public DateOnly MonthStartDate { get; set; }
    public DateOnly MonthEndDate { get; set; }

    public decimal TotalFoodCaloriesKcal { get; set; }
    public decimal TotalProteinGrams { get; set; }
    public decimal TotalFatGrams { get; set; }
    public decimal TotalCarbsGrams { get; set; }
    public decimal TotalAlcoholGrams { get; set; }

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

    public DateTime LastCalculatedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];

    // Navigation
    public User User { get; set; } = null!;
}
