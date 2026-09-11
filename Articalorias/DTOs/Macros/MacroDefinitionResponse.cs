using Articalorias.Services.Macros;

namespace Articalorias.DTOs.Macros;

public class LocalizedText
{
    public string En { get; set; } = string.Empty;
    public string Es { get; set; } = string.Empty;

    public static LocalizedText From(MacroLabels labels) => new() { En = labels.En, Es = labels.Es };
}

public class MacroCatalogResponse
{
    public string CatalogVersion { get; set; } = string.Empty;
    public List<MacroDefinitionResponse> Macros { get; set; } = [];
}

/// <summary>The UI-facing view of one catalog record: everything a screen needs, nothing the server keeps to itself.</summary>
public class MacroDefinitionResponse
{
    public string Key { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    /// <summary>"g" | "ml" | "mg"</summary>
    public string Unit { get; set; } = "g";
    /// <summary>"hit" | "limit"</summary>
    public string Direction { get; set; } = "hit";
    public bool IsCore { get; set; }
    public bool DefaultTracked { get; set; }
    public string Icon { get; set; } = string.Empty;
    public MacroLabelsResponse Labels { get; set; } = new();
    public MacroFormulaResponse TargetFormula { get; set; } = new();
    public List<MacroPresetResponse> AutoPresets { get; set; } = [];
    public decimal CustomTargetMin { get; set; }
    public decimal CustomTargetMax { get; set; }
    public List<MacroQuickAddResponse> QuickAdds { get; set; } = [];
    public bool ShowInHeroBars { get; set; }
    /// <summary>"always" | "whenTracked"</summary>
    public string RowStrip { get; set; } = "whenTracked";
    public bool HasOwnCard { get; set; }
    public bool IsActive { get; set; }
}

public class MacroLabelsResponse
{
    public LocalizedText Name { get; set; } = new();
    public LocalizedText ShortName { get; set; } = new();
}

public class MacroFormulaResponse
{
    /// <summary>none | perKgBodyWeight | percentOfBudget | carbsRemainder | fixedAmount | perKgBodyWeightCapped | perThousandKcal</summary>
    public string Kind { get; set; } = "none";
    public bool HasAutoTarget { get; set; }
    public bool HasAutoParam { get; set; }
    public decimal? DefaultParam { get; set; }
    public decimal? ParamMin { get; set; }
    public decimal? ParamMax { get; set; }
    /// <summary>The reference amount: the fixed value, or the ceiling of a capped per-kg formula.</summary>
    public decimal? FixedValue { get; set; }
}

public class MacroPresetResponse
{
    public string Id { get; set; } = string.Empty;
    public decimal Param { get; set; }
    public MacroPresetLabelsResponse Labels { get; set; } = new();
}

public class MacroPresetLabelsResponse
{
    public LocalizedText Name { get; set; } = new();
    public LocalizedText Description { get; set; } = new();
}

public class MacroQuickAddResponse
{
    public string Id { get; set; } = string.Empty;
    public string Icon { get; set; } = string.Empty;
    public MacroQuickAddLabelsResponse Labels { get; set; } = new();
    public decimal Amount { get; set; }
    public decimal CaloriesKcal { get; set; }
    /// <summary>Entry macros with core zeros expanded; the client keeps only the keys the day tracks.</summary>
    public Dictionary<string, decimal> Macros { get; set; } = new();
}

public class MacroQuickAddLabelsResponse
{
    public LocalizedText Name { get; set; } = new();
    public LocalizedText Portion { get; set; } = new();
}

public static class MacroCatalogMapper
{
    public static MacroCatalogResponse ToResponse() => new()
    {
        CatalogVersion = MacroCatalog.CatalogVersion,
        Macros = MacroCatalog.All.Select(ToResponse).ToList(),
    };

    public static MacroDefinitionResponse ToResponse(MacroDefinition def) => new()
    {
        Key = def.Key,
        SortOrder = def.SortOrder,
        Unit = def.UnitCode,
        Direction = def.DirectionCode,
        IsCore = def.IsCore,
        DefaultTracked = def.DefaultTracked,
        Icon = def.IconName,
        Labels = new MacroLabelsResponse
        {
            Name = LocalizedText.From(def.Name),
            ShortName = LocalizedText.From(def.ShortName),
        },
        TargetFormula = new MacroFormulaResponse
        {
            Kind = def.Formula.Kind,
            HasAutoTarget = def.HasAutoTarget,
            HasAutoParam = def.AutoParamRange is not null,
            DefaultParam = def.DefaultAutoParam,
            ParamMin = def.AutoParamRange?.Min,
            ParamMax = def.AutoParamRange?.Max,
            FixedValue = def.Formula switch
            {
                TargetFormula.FixedAmount fixedAmount => fixedAmount.Value,
                TargetFormula.PerKgBodyWeightCapped capped => capped.Cap,
                _ => null,
            },
        },
        AutoPresets = def.AutoPresets.Select(p => new MacroPresetResponse
        {
            Id = p.Id,
            Param = p.Param,
            Labels = new MacroPresetLabelsResponse
            {
                Name = LocalizedText.From(p.Name),
                Description = LocalizedText.From(p.Description),
            },
        }).ToList(),
        CustomTargetMin = def.CustomTargetMin,
        CustomTargetMax = def.CustomTargetMax,
        QuickAdds = def.QuickAdds.Select(q => new MacroQuickAddResponse
        {
            Id = q.Id,
            Icon = q.Icon,
            Labels = new MacroQuickAddLabelsResponse
            {
                Name = LocalizedText.From(q.Name),
                Portion = LocalizedText.From(q.Portion),
            },
            Amount = q.Amount,
            CaloriesKcal = q.CaloriesKcal,
            Macros = MacroAmounts.From(q.Macros).EnsureCore().ToDictionary(),
        }).ToList(),
        ShowInHeroBars = def.ShowInHeroBars,
        RowStrip = def.RowStripCode,
        HasOwnCard = def.HasOwnCard,
        IsActive = def.IsActive,
    };
}
