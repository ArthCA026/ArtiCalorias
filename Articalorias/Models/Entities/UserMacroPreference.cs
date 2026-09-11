namespace Articalorias.Models.Entities;

/// <summary>
/// One row per user per macro (protein included, since the catalog refactor).
/// A missing row means the catalog default for that macro
/// (<see cref="Services.Macros.MacroDefinition.DefaultTracked"/>: protein
/// tracked in auto mode, everything else off).
/// </summary>
public class UserMacroPreference
{
    public long UserMacroPreferenceId { get; set; }
    public long UserId { get; set; }

    /// <summary>Catalog key (<see cref="Services.Macros.MacroCatalog"/>).</summary>
    public string MacroKey { get; set; } = string.Empty;

    /// <summary>Show a progress bar and target for this macro from now on.</summary>
    public bool IsTracked { get; set; }

    /// <summary>"auto" (formula from profile) or "custom" (user-set value).</summary>
    public string TargetMode { get; set; } = "auto";

    /// <summary>Amount per day in the macro unit. Only meaningful when TargetMode = "custom".</summary>
    public decimal? CustomTargetValue { get; set; }

    /// <summary>
    /// User-chosen parameter of the auto formula, for macros that expose one
    /// (protein: grams per kg of body weight, from the presets). NULL = the
    /// catalog default. Kept while the macro is off so switching back on
    /// restores the choice.
    /// </summary>
    public decimal? AutoParam { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];

    // Navigation
    public User User { get; set; } = null!;
}
