using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Macros;

/// <summary>One macro's tracking configuration, catalog defaults merged in. Protein included.</summary>
public class MacroPreferenceResponse
{
    /// <summary>Catalog macro key.</summary>
    public string MacroKey { get; set; } = string.Empty;
    public bool IsTracked { get; set; }
    /// <summary>"auto" | "custom"</summary>
    public string TargetMode { get; set; } = "auto";
    public decimal? CustomTargetValue { get; set; }
    /// <summary>The auto-formula parameter in effect (protein g/kg); null when the macro has none.</summary>
    public decimal? AutoParam { get; set; }
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

    /// <summary>Omitted = keep the stored value. Validated against the catalog range.</summary>
    [Range(0, 100000)]
    public decimal? CustomTargetValue { get; set; }

    /// <summary>Omitted = keep the stored value. Only macros with an adjustable formula accept it.</summary>
    [Range(0, 1000)]
    public decimal? AutoParam { get; set; }
}

public class UpdateMacroPreferencesRequest
{
    /// <summary>
    /// One item per macro at most. The ceiling is far above any real catalog
    /// and only keeps an oversized body from being walked item by item; the
    /// service rejects unknown and repeated keys.
    /// </summary>
    [Required]
    [MaxLength(100)]
    public List<UpdateMacroPreferenceItem> Items { get; set; } = [];
}
