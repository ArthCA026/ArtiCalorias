namespace Articalorias.Models.Entities;

/// <summary>
/// One row per user per optional macro ("carbs", "fat", "alcohol", "sugar",
/// "water"). Protein is NOT here: its goal lives on UserProfile with its own
/// long-standing pipeline (snapshots, remaining, presets) and stays untouched.
/// A missing row means the macro is not tracked (the app's historical default).
/// </summary>
public class UserMacroPreference
{
    public long UserMacroPreferenceId { get; set; }
    public long UserId { get; set; }

    /// <summary>Macro key: one of <see cref="Services.MacroTargets.OptionalMacroKeys"/>.</summary>
    public string MacroKey { get; set; } = string.Empty;

    /// <summary>Show a progress bar and target for this macro from now on.</summary>
    public bool IsTracked { get; set; }

    /// <summary>"auto" (formula from profile) or "custom" (user-set value).</summary>
    public string TargetMode { get; set; } = "auto";

    /// <summary>Grams per day (ml for water). Only meaningful when TargetMode = "custom".</summary>
    public decimal? CustomTargetValue { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];

    // Navigation
    public User User { get; set; } = null!;
}
