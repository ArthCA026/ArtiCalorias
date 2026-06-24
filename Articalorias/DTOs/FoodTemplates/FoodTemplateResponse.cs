namespace Articalorias.DTOs.FoodTemplates;

public class FoodTemplateResponse
{
    public long FoodTemplateId { get; set; }
    public string TemplateName { get; set; } = string.Empty;
    public string PortionDescription { get; set; } = string.Empty;
    public decimal DefaultQuantity { get; set; }
    public decimal CaloriesKcal { get; set; }
    public decimal ProteinGrams { get; set; }
    public decimal FatGrams { get; set; }
    public decimal CarbsGrams { get; set; }
    public decimal AlcoholGrams { get; set; }
    public bool AutoAddToNewDay { get; set; }
    public bool IsActive { get; set; }
}
