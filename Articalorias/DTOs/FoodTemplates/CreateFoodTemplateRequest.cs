using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.FoodTemplates;

public class CreateFoodTemplateRequest
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

    [Range(0, 9999.99)]
    public decimal ProteinGrams { get; set; }

    [Range(0, 9999.99)]
    public decimal FatGrams { get; set; }

    [Range(0, 9999.99)]
    public decimal CarbsGrams { get; set; }

    [Range(0, 9999.99)]
    public decimal AlcoholGrams { get; set; }

    [Range(0, 9999.99)]
    public decimal? SugarGrams { get; set; }

    [Range(0, 99999.99)]
    public decimal? WaterMl { get; set; }

    public bool AutoAddToNewDay { get; set; }
}
