using System.ComponentModel.DataAnnotations;
using Articalorias.Services.Macros;

namespace Articalorias.DTOs.FoodEntries;

public class UpdateFoodEntryRequest : IValidatableObject
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

    /// <summary>
    /// TOTAL amounts eaten keyed by catalog macro key (absent = not captured,
    /// core macros default to 0). Ignored when <see cref="ScaleByQuantity"/> is true.
    /// </summary>
    public Dictionary<string, decimal>? Macros { get; set; }

    [StringLength(500)]
    public string? Notes { get; set; }

    /// <summary>
    /// When true, the API ignores the submitted calories and macros and instead
    /// scales the existing stored values by (new Quantity / old Quantity).
    /// </summary>
    public bool ScaleByQuantity { get; set; } = false;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        => ScaleByQuantity ? [] : MacroInputValidator.Validate(Macros);
}
