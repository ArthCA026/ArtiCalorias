namespace Articalorias.Services.Macros;

/// <summary>Unit an amount is expressed in. Serialized to the API as "g" | "ml" | "mg".</summary>
public enum MacroUnit { Grams, Milliliters, Milligrams }

/// <summary>How a target reads: a goal to reach ("hit") or a ceiling to stay under ("limit").</summary>
public enum MacroDirection { Hit, Limit }

/// <summary>
/// How an AUTO target is derived from the profile. A closed set of shapes so
/// every formula the app supports lives in <see cref="MacroFormulas"/>; a new
/// macro picks one of these instead of adding code.
/// </summary>
public abstract record TargetFormula
{
    private TargetFormula() { }

    /// <summary>No formula: a target only exists when the user sets a custom one.</summary>
    public sealed record None : TargetFormula { }

    /// <summary>
    /// weight x param, where param defaults to <paramref name="DefaultParam"/> and can
    /// be overridden per user (protein presets). <paramref name="ApplyAgeFloor"/> raises
    /// the multiplier to the evidence-informed age minimum (protein only).
    /// </summary>
    public sealed record PerKgBodyWeight(decimal DefaultParam, bool ApplyAgeFloor = false, decimal RoundToMultiple = 1m) : TargetFormula;

    /// <summary>A share of the calorie budget converted to grams via the macro kcal/g, optionally capped.</summary>
    public sealed record PercentOfBudget(decimal Percent, decimal? Cap = null) : TargetFormula;

    /// <summary>Whatever calories remain after protein and fat, in grams of carbs.</summary>
    public sealed record CarbsRemainder : TargetFormula { }

    /// <summary>A fixed public-health reference amount (sodium 2300 mg).</summary>
    public sealed record FixedAmount(decimal Value) : TargetFormula;

    /// <summary>
    /// weight x per-kg reference, never above <paramref name="Cap"/>, with a
    /// lower per-kg figure for minors and the cap itself when no weight is
    /// known (caffeine: 5.7 mg/kg for adults, 2.5 mg/kg under 18, 400 mg cap).
    /// </summary>
    public sealed record PerKgBodyWeightCapped(decimal AdultPerKg, decimal MinorPerKg, decimal Cap, decimal RoundToMultiple = 1m) : TargetFormula;

    /// <summary>
    /// An amount per 1000 kcal of the calorie budget, kept inside a reference
    /// band (fibre: 14 g per 1000 kcal, never under 25 g nor over 40 g). The
    /// band matters on a deficit, where the budget shrinks but the need does
    /// not. <paramref name="Min"/> is also the target until the body is known.
    /// </summary>
    public sealed record PerThousandKcal(decimal ValuePer1000Kcal, decimal? Min = null, decimal? Max = null) : TargetFormula;

    /// <summary>Stable wire name for the API catalog.</summary>
    public string Kind => this switch
    {
        None => "none",
        PerKgBodyWeight => "perKgBodyWeight",
        PercentOfBudget => "percentOfBudget",
        CarbsRemainder => "carbsRemainder",
        FixedAmount => "fixedAmount",
        PerKgBodyWeightCapped => "perKgBodyWeightCapped",
        PerThousandKcal => "perThousandKcal",
        _ => "none",
    };
}

/// <summary>
/// A user-facing string in both app languages. Macro names ship from the API
/// (instead of the UI i18n catalog) so adding a macro needs no UI copy edits.
/// </summary>
public sealed record MacroLabels(string En, string Es)
{
    public string For(string? lang)
        => lang is not null && lang.StartsWith("es", StringComparison.OrdinalIgnoreCase) ? Es : En;
}

/// <summary>A named value for a macro adjustable auto parameter (protein g/kg presets).</summary>
public sealed record AutoPreset(string Id, decimal Param, MacroLabels Name, MacroLabels Description);

/// <summary>
/// One tap on the day view that logs a ready-made entry (a glass of water, a
/// beer, a coffee). <paramref name="Macros"/> lists only the meaningful keys;
/// the API response expands core zeros, and the client keeps only the keys
/// the day tracks so an untracked macro is never written as a fake 0.
/// </summary>
public sealed record QuickAdd(
    string Id,
    string Icon,
    MacroLabels Name,
    MacroLabels Portion,
    decimal Amount,
    decimal CaloriesKcal,
    IReadOnlyDictionary<string, decimal> Macros);

/// <summary>
/// An Open Food Facts nutriment the macro can be read from, in priority order.
/// <paramref name="UnitFactor"/> converts the OFF unit (grams for almost
/// everything) into the macro unit (x1000 for mg).
/// <paramref name="IsConcentration"/> marks a nutriment OFF expresses as a
/// share of the product (alcohol, % vol) and therefore repeats unscaled in
/// its per-serving field: the amount is always derived from the per-100
/// figure and the serving size, never read from the per-serving one.
/// </summary>
public sealed record OffSource(string NutrimentKey, decimal UnitFactor, bool IsConcentration = false);

/// <summary>
/// Everything the app knows about one macro type. One record per macro in
/// <see cref="MacroCatalog"/> drives storage, validation, targets, TEF, the AI
/// schema and prompt, barcode mapping and the UI catalog endpoint.
/// </summary>
public sealed record MacroDefinition
{
    /// <summary>Stable lowercase identifier. Never renamed or deleted once shipped.</summary>
    public required string Key { get; init; }
    public required int SortOrder { get; init; }
    public required MacroUnit Unit { get; init; }
    public required MacroDirection Direction { get; init; }

    /// <summary>
    /// Core macros are always parsed by the AI and always present in stored
    /// maps (0 when absent). Optional ones exist on an entry only when they
    /// were tracked at the time it was logged.
    /// </summary>
    public required bool IsCore { get; init; }

    /// <summary>Tracking state assumed when the user has no preference row.</summary>
    public bool DefaultTracked { get; init; }

    /// <summary>Atwater energy density; 0 for non-energy macros.</summary>
    public decimal KcalPerGram { get; init; }

    /// <summary>Thermic effect of food rate; 0 for macros that do not contribute.</summary>
    public decimal TefRate { get; init; }

    /// <summary>A macro this one is a subset of (sugar within carbs): amounts are clamped to the parent.</summary>
    public string? ParentKey { get; init; }

    /// <summary>Short JSON key the AI answers with ("prot", "sug", "caf").</summary>
    public required string AiWireKey { get; init; }
    public required string AiSchemaDescription { get; init; }

    /// <summary>Extraction rule appended to the prompt when this optional macro is tracked (without the leading "- key:").</summary>
    public string? AiPromptRule { get; init; }

    /// <summary>Plausibility ceiling for ONE unit before quantity scaling.</summary>
    public required decimal PreScaleMax { get; init; }

    /// <summary>Hard ceiling per stored entry (validation and post-scale clamp).</summary>
    public required decimal MaxPerEntry { get; init; }

    public IReadOnlyList<OffSource> OffSources { get; init; } = [];

    public required TargetFormula Formula { get; init; }
    public IReadOnlyList<AutoPreset> AutoPresets { get; init; } = [];

    /// <summary>Allowed range of the user-adjustable auto parameter; null = not adjustable.</summary>
    public (decimal Min, decimal Max)? AutoParamRange { get; init; }

    public decimal CustomTargetMin { get; init; }
    public required decimal CustomTargetMax { get; init; }

    public IReadOnlyList<QuickAdd> QuickAdds { get; init; } = [];

    /// <summary>Renders as a bar inside the calorie hero (own-card macros are excluded there).</summary>
    public bool ShowInHeroBars { get; init; }

    /// <summary>
    /// Listed in the day's macro totals even when the user does not track it
    /// (protein, fat and carbs: where the calories came from). Meal and
    /// template rows never use this: their strip shows tracked macros only.
    /// </summary>
    public bool AlwaysInDayTotals { get; init; }

    /// <summary>Icon name in the UI icon set; unknown names fall back to a generic icon there.</summary>
    public required string IconName { get; init; }
    public required MacroLabels Name { get; init; }
    public required MacroLabels ShortName { get; init; }

    /// <summary>Retired macros stay in the catalog (history keeps rendering) but accept no new input.</summary>
    public bool IsActive { get; init; } = true;

    public bool HasOwnCard => QuickAdds.Count > 0;
    public bool HasAutoTarget => Formula is not TargetFormula.None;
    public decimal? DefaultAutoParam => Formula is TargetFormula.PerKgBodyWeight p ? p.DefaultParam : null;

    public string UnitCode => Unit switch
    {
        MacroUnit.Grams => "g",
        MacroUnit.Milliliters => "ml",
        _ => "mg",
    };

    public string DirectionCode => Direction == MacroDirection.Limit ? "limit" : "hit";

    /// <summary>
    /// Energy this macro adds on its own: a child is already counted inside
    /// its parent (sugar within carbs), so it adds none.
    /// </summary>
    public decimal EnergyKcalPerGram => ParentKey is null ? KcalPerGram : 0m;

    /// <summary>Priced by <see cref="MacroTef"/>: an energy macro with a rate that is not a subset of another.</summary>
    public bool ContributesToTef => EnergyKcalPerGram > 0m && TefRate > 0m;
}
