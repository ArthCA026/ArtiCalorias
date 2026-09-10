using System.Text.RegularExpressions;
using Articalorias.DTOs.ActivityParsing;
using Articalorias.DTOs.FoodParsing;

namespace Articalorias.Services.Parsing;

/// <summary>
/// Post-processing shared by every food parse path (text, vision, combined):
/// clamp bad AI output, scale per-unit nutrition by quantity, normalize
/// portion descriptions. Returns a possibly-empty list — throwing on empty is
/// the caller's decision (the combined parser legitimately gets empty sides).
/// </summary>
internal static partial class FoodItemSanitizer
{
    [GeneratedRegex(@"^1\s+")]
    private static partial Regex LeadingOnePattern();

    public static List<ParsedFoodItem> Sanitize(List<ParsedFoodItem> items, FoodParsingOptions options)
    {
        var sanitized = new List<ParsedFoodItem>();

        foreach (var item in items)
        {
            if (string.IsNullOrWhiteSpace(item.FoodName))
                continue;

            // Clamp negatives to zero
            item.CaloriesKcal = Math.Max(0, item.CaloriesKcal);
            item.ProteinGrams = Math.Max(0, item.ProteinGrams);
            item.FatGrams = Math.Max(0, item.FatGrams);
            item.CarbsGrams = Math.Max(0, item.CarbsGrams);
            item.AlcoholGrams = Math.Max(0, item.AlcoholGrams);

            // Optional fields: only kept when they were requested (an untracked
            // macro must stay NULL in the database — NULL is what lets old days
            // say "not tracked then"), clamped into physical plausibility.
            item.SugarGrams = options.IncludeSugar
                ? Math.Min(Math.Max(0, item.SugarGrams ?? 0), item.CarbsGrams)
                : null;
            item.WaterMl = options.IncludeWater
                ? Math.Clamp(item.WaterMl ?? 0, 0, 5000)
                : null;

            // Reject absurd single-item values
            if (item.CaloriesKcal > 10000)
                item.CaloriesKcal = 0;

            sanitized.Add(item);
        }

        // Multiply per-unit nutrition by quantity — the model always answers
        // for exactly one unit; this is the only place totals are computed.
        foreach (var item in sanitized)
        {
            var qty = item.Quantity ?? 1m;
            if (qty <= 0) qty = 1m;

            item.CaloriesKcal = Math.Round(item.CaloriesKcal * qty, 1);
            item.ProteinGrams = Math.Round(item.ProteinGrams * qty, 1);
            item.FatGrams     = Math.Round(item.FatGrams     * qty, 1);
            item.CarbsGrams   = Math.Round(item.CarbsGrams   * qty, 1);
            item.AlcoholGrams = Math.Round(item.AlcoholGrams * qty, 1);
            if (item.SugarGrams.HasValue)
                item.SugarGrams = Math.Round(item.SugarGrams.Value * qty, 1);
            if (item.WaterMl.HasValue)
                item.WaterMl = Math.Round(item.WaterMl.Value * qty, 1);

            // "1 huevo entero" → "huevo entero": the quantity field already
            // carries the count, so a leading 1 in the portion text is noise.
            if (!string.IsNullOrWhiteSpace(item.PortionDescription))
                item.PortionDescription = LeadingOnePattern().Replace(item.PortionDescription, string.Empty);
        }

        return sanitized;
    }
}

/// <summary>
/// Post-processing shared by every activity parse path. Same contract as
/// <see cref="FoodItemSanitizer"/>: clamp, drop invalid, never throw.
/// </summary>
internal static class ActivityItemSanitizer
{
    public static List<ParsedActivityItem> Sanitize(List<ParsedActivityItem> items)
    {
        var sanitized = new List<ParsedActivityItem>();

        foreach (var item in items)
        {
            // A nameless item is only acceptable on the smart-watch path, where the
            // stated calories make it computable (the backend names it "Exercise").
            if (string.IsNullOrWhiteSpace(item.ActivityName) && item.CaloriesKcal is not > 0m)
                continue;

            if (item.DurationMinutes.HasValue)
                item.DurationMinutes = Math.Clamp(item.DurationMinutes.Value, 0, 1440);

            if (item.MetValue.HasValue)
                item.MetValue = Math.Clamp(item.MetValue.Value, 0.5m, 50m);

            if (item.CaloriesKcal.HasValue)
                item.CaloriesKcal = Math.Clamp(item.CaloriesKcal.Value, 0m, 10000m);

            sanitized.Add(item);
        }

        return sanitized;
    }
}
