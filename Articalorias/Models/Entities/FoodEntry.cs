using Articalorias.Services.Macros;

namespace Articalorias.Models.Entities;

public class FoodEntry
{
    public long FoodEntryId { get; set; }
    public long DailyLogId { get; set; }

    public string FoodName { get; set; } = string.Empty;
    public string? PortionDescription { get; set; }
    public decimal? Quantity { get; set; }

    public decimal CaloriesKcal { get; set; }

    /// <summary>
    /// TOTAL amounts eaten (already multiplied by Quantity), keyed by catalog
    /// macro key and stored as JSON. Absent key = not captured when this
    /// entry was logged (the macro was not tracked then), present 0 = captured
    /// and genuinely zero; that distinction lets old days say "not tracked
    /// then" instead of showing a fake 0. Core macros are always present.
    /// </summary>
    public MacroAmounts Macros { get; set; } = MacroAmounts.Empty;

    public int SortOrder { get; set; }
    public string? Notes { get; set; }

    public long? FoodTemplateId { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];

    // Navigation
    public DailyLog DailyLog { get; set; } = null!;
    public FoodTemplate? FoodTemplate { get; set; }
}
