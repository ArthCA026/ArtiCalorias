namespace Articalorias.DTOs.FoodParsing;

/// <summary>
/// Which OPTIONAL nutrition fields the AI parser should extract, derived from
/// the caller's tracked macros. Kept deliberately narrow: asking the model for
/// data nobody displays makes parsing slower, costlier and less accurate, so
/// the default (nothing extra) reproduces the pre-feature prompt byte for byte.
/// Protein, fat, carbs and alcohol are always parsed (they always were).
/// </summary>
public sealed record FoodParsingOptions(bool IncludeSugar, bool IncludeWater)
{
    public static readonly FoodParsingOptions None = new(false, false);
}
