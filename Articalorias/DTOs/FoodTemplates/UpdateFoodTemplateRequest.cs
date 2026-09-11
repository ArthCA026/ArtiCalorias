using System.ComponentModel.DataAnnotations;
using Articalorias.Services.Macros;

namespace Articalorias.DTOs.FoodTemplates;

public class UpdateFoodTemplateRequest : IValidatableObject
{
    [Required]
    [StringLength(150)]
    public string TemplateName { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string PortionDescription { get; set; } = string.Empty;

    [Range(0.001, 9999.999)]
    public decimal DefaultQuantity { get; set; } = 1m;

    [Range(0, 9999.99)]
    public decimal CaloriesKcal { get; set; }

    /// <summary>Amounts PER 1 PORTION keyed by catalog macro key (absent = not captured, core macros default to 0).</summary>
    public Dictionary<string, decimal>? Macros { get; set; }

    public bool AutoAddToNewDay { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        => MacroInputValidator.Validate(Macros);
}
