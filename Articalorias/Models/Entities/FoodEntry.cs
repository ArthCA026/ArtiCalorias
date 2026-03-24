namespace Articalorias.Models.Entities;

public class FoodEntry
{
    public long FoodEntryId { get; set; }
    public long DailyLogId { get; set; }

    public string FoodName { get; set; } = string.Empty;
    public string? PortionDescription { get; set; }
    public decimal? Quantity { get; set; }
    public string? Unit { get; set; }

    public decimal CaloriesKcal { get; set; }
    public decimal ProteinGrams { get; set; }
    public decimal FatGrams { get; set; }
    public decimal CarbsGrams { get; set; }
    public decimal AlcoholGrams { get; set; }

    public string SourceType { get; set; } = "MANUAL";
    public int SortOrder { get; set; }
    public string? Notes { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];

    // Navigation
    public DailyLog DailyLog { get; set; } = null!;
}
