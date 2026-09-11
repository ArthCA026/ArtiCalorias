namespace Articalorias.DTOs.FoodParsing;

/// <summary>
/// A single food item proposed by AI parsing or a barcode lookup.
/// Not persisted until the user confirms.
/// </summary>
public class ParsedFoodItem
{
    public string FoodName { get; set; } = string.Empty;
    public string? PortionDescription { get; set; }
    public decimal? Quantity { get; set; }
    public decimal CaloriesKcal { get; set; }

    /// <summary>
    /// Amounts keyed by catalog macro key, already multiplied by quantity.
    /// Core macros are always present; an optional macro is present only when
    /// it was requested (AI) or the label provided it (barcode).
    /// </summary>
    public Dictionary<string, decimal> Macros { get; set; } = new(StringComparer.Ordinal);
}
