namespace Articalorias.DTOs.FoodEntries;

public class FoodEntryResponse
{
    public long FoodEntryId { get; set; }
    public string FoodName { get; set; } = string.Empty;
    public string? PortionDescription { get; set; }
    public decimal? Quantity { get; set; }
    public decimal CaloriesKcal { get; set; }

    /// <summary>
    /// TOTAL amounts eaten keyed by catalog macro key. Absent key = not
    /// captured when this entry was logged (macro not tracked then); core
    /// macros are always present.
    /// </summary>
    public Dictionary<string, decimal> Macros { get; set; } = new();

    public int SortOrder { get; set; }
    public string? Notes { get; set; }
}
