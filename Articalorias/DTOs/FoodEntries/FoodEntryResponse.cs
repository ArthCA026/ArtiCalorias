namespace Articalorias.DTOs.FoodEntries;

public class FoodEntryResponse
{
    public long FoodEntryId { get; set; }
    public string FoodName { get; set; } = string.Empty;
    public string? PortionDescription { get; set; }
    public decimal? Quantity { get; set; }
    public string? Unit { get; set; }
    public decimal CaloriesKcal { get; set; }
    public decimal ProteinGrams { get; set; }
    public decimal FatGrams { get; set; }
    public decimal CarbsGrams { get; set; }
    public decimal AlcoholGrams { get; set; }
    public string SourceType { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public string? Notes { get; set; }
}
