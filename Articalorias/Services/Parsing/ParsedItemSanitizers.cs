using System.Text.RegularExpressions;
using Articalorias.DTOs.ActivityParsing;
using Articalorias.DTOs.FoodParsing;
using Articalorias.Services.Macros;

namespace Articalorias.Services.Parsing;

/// <summary>
/// Post-processing shared by every food parse path (text, vision, combined):
/// clamp bad AI output, scale per-unit nutrition by quantity, normalize
/// portion descriptions. Returns a possibly-empty list — throwing on empty is
/// the caller's decision (the combined parser legitimately gets empty sides).
/// Every per-macro rule (ceilings, parent clamps, which keys survive) comes
/// from the catalog, so a new macro needs no change here.
/// </summary>
internal static partial class FoodItemSanitizer
{
    private const decimal MaxKcalPerUnit = 10000m;
    private const decimal MaxKcalPerEntry = 50000m;

    [GeneratedRegex(@"^1\s+")]
    private static partial Regex LeadingOnePattern();

    // Bare measure-only portion descriptions. Combined with a large qty and a
    // clearly non-per-gram kcal, they identify the gram-count failure mode.
    private static readonly HashSet<string> BareMeasureUnits = new(StringComparer.OrdinalIgnoreCase)
    {
        "g", "gr", "gramo", "gramos", "gram", "grams",
        "ml", "mililitro", "mililitros", "milliliter", "milliliters", "cc"
    };

    public static List<ParsedFoodItem> Sanitize(List<ParsedFoodItem> items, FoodParsingOptions options)
    {
        // Core macros always survive; optional ones only when they were
        // requested (an untracked macro must stay ABSENT in the database —
        // absence is what lets old days say "not tracked then"). Catalog
        // order guarantees a parent is clamped before its children.
        var keep = MacroCatalog.Core.Concat(options.OptionalDefinitions)
            .OrderBy(d => d.SortOrder)
            .ToList();

        var sanitized = new List<ParsedFoodItem>();

        foreach (var item in items)
        {
            if (string.IsNullOrWhiteSpace(item.FoodName))
                continue;

            item.CaloriesKcal = Math.Max(0, item.CaloriesKcal);

            var cleaned = new Dictionary<string, decimal>(StringComparer.Ordinal);
            foreach (var def in keep)
            {
                var value = item.Macros.GetValueOrDefault(def.Key, 0m);
                value = Math.Clamp(value, 0m, def.PreScaleMax);
                if (def.ParentKey is not null && cleaned.TryGetValue(def.ParentKey, out var parent))
                    value = Math.Min(value, parent);
                cleaned[def.Key] = value;
            }
            item.Macros = cleaned;

            // Reject absurd single-item values
            if (item.CaloriesKcal > MaxKcalPerUnit)
                item.CaloriesKcal = 0;

            // Repair the gram-count failure mode: for "350g de carne" the
            // model may answer qty 350, unit "g" with WHOLE-portion nutrition
            // (875 kcal) — scaling would then multiply the portion by its own
            // weight. Pure fat is only ~9 kcal/g, so kcal ≥ 20 on a bare g/ml
            // portion cannot be per-gram: collapse it to one unit that carries
            // the amount ("350 g"), which is also how the prompt now asks for
            // weights. Runs on cache replays too, healing old bad entries.
            if (item.Quantity is >= 20m
                && item.CaloriesKcal >= 20
                && item.PortionDescription is not null
                && BareMeasureUnits.Contains(item.PortionDescription.Trim()))
            {
                item.PortionDescription = $"{item.Quantity.Value:0.#} {item.PortionDescription.Trim()}";
                item.Quantity = 1;
            }

            sanitized.Add(item);
        }

        // Multiply per-unit nutrition by quantity — the model always answers
        // for exactly one unit; this is the only place totals are computed.
        foreach (var item in sanitized)
        {
            var qty = item.Quantity ?? 1m;
            if (qty <= 0) qty = 1m;

            // Post-scale ceilings mirror the request DTOs' ranges: whatever
            // survives here must always be confirmable (the user can still
            // review and edit an implausible value; a 400 on confirm is a
            // dead end).
            item.CaloriesKcal = Math.Min(Math.Round(item.CaloriesKcal * qty, 1), MaxKcalPerEntry);

            foreach (var def in keep)
            {
                if (!item.Macros.TryGetValue(def.Key, out var value))
                    continue;
                value = Math.Min(Math.Round(value * qty, 1), def.MaxPerEntry);
                if (def.ParentKey is not null && item.Macros.TryGetValue(def.ParentKey, out var parent))
                    value = Math.Min(value, parent);
                item.Macros[def.Key] = value;
            }

            // "1 huevo entero" → "huevo entero": the quantity field already
            // carries the count, so a leading 1 in the portion text is noise.
            if (!string.IsNullOrWhiteSpace(item.PortionDescription))
                item.PortionDescription = LeadingOnePattern().Replace(item.PortionDescription, string.Empty);
        }

        return sanitized;
    }

    /// <summary>
    /// Label data (barcode lookups) is already a total for the stated portion:
    /// no quantity scaling and no tracked-key gating (a label value costs
    /// nothing, so whatever it provides is kept for the day the user starts
    /// tracking it). Clamps into range, forces core zeros, honors parents.
    /// </summary>
    public static ParsedFoodItem SanitizeLabelData(ParsedFoodItem item)
    {
        item.CaloriesKcal = Math.Clamp(item.CaloriesKcal, 0m, MaxKcalPerEntry);

        var cleaned = new Dictionary<string, decimal>(StringComparer.Ordinal);
        foreach (var def in MacroCatalog.Active)
        {
            if (item.Macros.TryGetValue(def.Key, out var value))
                cleaned[def.Key] = Math.Clamp(Math.Round(value, 2), 0m, def.MaxPerEntry);
            else if (def.IsCore)
                cleaned[def.Key] = 0m;
        }

        foreach (var def in MacroCatalog.Active)
        {
            if (def.ParentKey is null || !cleaned.TryGetValue(def.Key, out var child))
                continue;
            if (cleaned.TryGetValue(def.ParentKey, out var parent) && child > parent)
                cleaned[def.Key] = parent;
        }

        item.Macros = cleaned;
        return item;
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
