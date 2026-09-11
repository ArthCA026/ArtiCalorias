namespace Articalorias.DTOs.FoodTemplates;

public class FoodTemplateResponse
{
    public long FoodTemplateId { get; set; }
    public string TemplateName { get; set; } = string.Empty;
    public string PortionDescription { get; set; } = string.Empty;
    public decimal DefaultQuantity { get; set; }
    public decimal CaloriesKcal { get; set; }

    /// <summary>Amounts PER 1 PORTION keyed by catalog macro key (absent = not captured).</summary>
    public Dictionary<string, decimal> Macros { get; set; } = new();

    public bool AutoAddToNewDay { get; set; }
    public bool IsActive { get; set; }
}
