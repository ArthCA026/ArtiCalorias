using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Macros;

/// <summary>One optional macro's tracking configuration, defaults merged in.</summary>
public class MacroPreferenceResponse
{
    /// <summary>"carbs" | "fat" | "alcohol" | "sugar" | "water"</summary>
    public string MacroKey { get; set; } = string.Empty;
    public bool IsTracked { get; set; }
    /// <summary>"auto" | "custom"</summary>
    public string TargetMode { get; set; } = "auto";
    public decimal? CustomTargetValue { get; set; }
    /// <summary>What the auto formula currently yields (null = profile incomplete or no formula, e.g. alcohol).</summary>
    public decimal? AutoTargetValue { get; set; }
    /// <summary>The target that would be frozen onto a new day right now.</summary>
    public decimal? EffectiveTarget { get; set; }
    /// <summary>"hit" or "limit".</summary>
    public string Direction { get; set; } = "hit";
}

public class UpdateMacroPreferenceItem
{
    [Required]
    [StringLength(20)]
    public string MacroKey { get; set; } = string.Empty;

    public bool IsTracked { get; set; }

    [RegularExpression("^(auto|custom)$")]
    public string TargetMode { get; set; } = "auto";

    [Range(0, 20000)]
    public decimal? CustomTargetValue { get; set; }
}

public class UpdateMacroPreferencesRequest
{
    [Required]
    public List<UpdateMacroPreferenceItem> Items { get; set; } = [];
}
