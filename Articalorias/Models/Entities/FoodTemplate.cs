using Articalorias.Services.Macros;

namespace Articalorias.Models.Entities;

public class FoodTemplate
{
    public long FoodTemplateId { get; set; }
    public long UserId { get; set; }
    public string TemplateName { get; set; } = string.Empty;
    public string PortionDescription { get; set; } = string.Empty;
    public decimal DefaultQuantity { get; set; } = 1m;
    public decimal CaloriesKcal { get; set; }

    /// <summary>
    /// Amounts PER 1 PORTION keyed by catalog macro key (see
    /// <see cref="Services.FoodTemplateMath"/> for the scaling rule when a
    /// template becomes an entry). Absent key = not captured when the
    /// template was saved.
    /// </summary>
    public MacroAmounts Macros { get; set; } = MacroAmounts.Empty;

    public bool AutoAddToNewDay { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];

    // Navigation
    public User User { get; set; } = null!;
    public ICollection<FoodEntry> FoodEntries { get; set; } = [];
}
