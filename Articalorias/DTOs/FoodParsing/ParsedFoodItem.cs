namespace Articalorias.DTOs.FoodParsing;

/// <summary>
/// A single food item proposed by OpenAI parsing.
/// Not persisted until the user confirms.
/// </summary>
public class ParsedFoodItem
{
    public string FoodName { get; set; } = string.Empty;
    public string? PortionDescription { get; set; }
    public decimal? Quantity { get; set; }
    public decimal CaloriesKcal { get; set; }
    public decimal ProteinGrams { get; set; }
    public decimal FatGrams { get; set; }
    public decimal CarbsGrams { get; set; }
    public decimal AlcoholGrams { get; set; }

    /// <summary>Only requested (and returned) when the user tracks sugar.</summary>
    public decimal? SugarGrams { get; set; }

    /// <summary>Only requested (and returned) when the user tracks water.</summary>
    public decimal? WaterMl { get; set; }
}
