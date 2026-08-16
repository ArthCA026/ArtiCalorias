namespace Articalorias.Models.Entities;

public class FoodTemplate
{
    public long FoodTemplateId { get; set; }
    public long UserId { get; set; }
    public string TemplateName { get; set; } = string.Empty;
    public string PortionDescription { get; set; } = string.Empty;
    public decimal DefaultQuantity { get; set; } = 1m;
    public decimal CaloriesKcal { get; set; }
    public decimal ProteinGrams { get; set; }
    public decimal FatGrams { get; set; }
    public decimal CarbsGrams { get; set; }
    public decimal AlcoholGrams { get; set; }
    public decimal? SugarGrams { get; set; }
    public decimal? WaterMl { get; set; }
    public bool AutoAddToNewDay { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];

    // Navigation
    public User User { get; set; } = null!;
    public ICollection<FoodEntry> FoodEntries { get; set; } = [];
}
