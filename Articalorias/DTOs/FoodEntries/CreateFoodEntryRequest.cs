using System.ComponentModel.DataAnnotations;
using Articalorias.Services.Macros;

namespace Articalorias.DTOs.FoodEntries;

public class CreateFoodEntryRequest : IValidatableObject
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
    /// TOTAL amounts eaten keyed by catalog macro key. Omit a key to record
    /// "not captured" (never send 0 for a macro that was not measured); core
    /// macros default to 0 when missing. Validated against the catalog.
    /// </summary>
    public Dictionary<string, decimal>? Macros { get; set; }

    public long? FoodTemplateId { get; set; }

    [StringLength(500)]
    public string? Notes { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        => MacroInputValidator.Validate(Macros);
}
