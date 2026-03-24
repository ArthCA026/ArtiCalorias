using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.FoodEntries;

public class CreateFoodEntryRequest
{
    [Required]
    [StringLength(200)]
    public string FoodName { get; set; } = string.Empty;

    [StringLength(200)]
    public string? PortionDescription { get; set; }

    [Range(0, 100000)]
    public decimal? Quantity { get; set; }

    [StringLength(50)]
    public string? Unit { get; set; }

    [Range(0, 50000)]
    public decimal CaloriesKcal { get; set; }

    [Range(0, 10000)]
    public decimal ProteinGrams { get; set; }

    [Range(0, 10000)]
    public decimal FatGrams { get; set; }

    [Range(0, 10000)]
    public decimal CarbsGrams { get; set; }

    [Range(0, 10000)]
    public decimal AlcoholGrams { get; set; }

    [Required]
    [StringLength(10)]
    public string SourceType { get; set; } = "MANUAL";

    [StringLength(500)]
    public string? Notes { get; set; }
}
