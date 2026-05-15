using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.FoodEntries;

public class UpdateFoodEntryRequest
{
    [Required]
    [StringLength(200)]
    public string FoodName { get; set; } = string.Empty;

    [StringLength(200)]
    public string? PortionDescription { get; set; }

    [Range(0, 100000)]
    public decimal? Quantity { get; set; }

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

    [StringLength(500)]
    public string? Notes { get; set; }

    /// <summary>
    /// When true, the API ignores the submitted macro values and instead scales
    /// the existing stored macros by (new Quantity / old Quantity).
    /// </summary>
    public bool ScaleByQuantity { get; set; } = false;
}
