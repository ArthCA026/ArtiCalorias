using System.Text.Json;
using System.Text.Json.Serialization;
using Articalorias.DTOs.ActivityParsing;
using Articalorias.DTOs.FoodParsing;
using Articalorias.Services.Macros;

namespace Articalorias.Services.Parsing;

// Wire-level DTOs matching the JSON the model returns. Keys are short but
// MEANINGFUL: measured with the o200k tokenizer, `"prot":` costs the same
// 3 tokens as `"p":` (quotes+colon dominate), and real words give a small
// model pretrained semantics to anchor on. These types translate back to the
// app's real DTOs.

internal sealed class WireFoodResponse
{
    public List<WireFoodItem> Items { get; set; } = [];
}

internal sealed class WireFoodItem
{
    /// <summary>Food name ("name").</summary>
    public string? Name { get; set; }

    /// <summary>Portion description of ONE unit ("unit").</summary>
    public string? Unit { get; set; }

    /// <summary>Quantity of units ("qty").</summary>
    public decimal? Qty { get; set; }

    public decimal Kcal { get; set; }

    /// <summary>
    /// Every macro the model answered with, under its catalog wire key
    /// ("prot", "sug", "caf"...). Captured generically so a new catalog macro
    /// needs no wire-model change; the strict schema guarantees only known
    /// keys ever arrive.
    /// </summary>
    [JsonExtensionData]
    public Dictionary<string, JsonElement>? Macros { get; set; }

    public ParsedFoodItem ToParsedFoodItem()
    {
        var item = new ParsedFoodItem
        {
            FoodName = Name ?? string.Empty,
            PortionDescription = Unit,
            Quantity = Qty,
            CaloriesKcal = Kcal,
        };

        if (Macros is not null)
        {
            foreach (var (wireKey, element) in Macros)
            {
                if (!MacroCatalog.ByWireKey.TryGetValue(wireKey, out var def))
                    continue;
                if (element.ValueKind == JsonValueKind.Number && element.TryGetDecimal(out var value))
                    item.Macros[def.Key] = value;
            }
        }

        return item;
    }
}

internal sealed class WireActivityResponse
{
    public List<WireActivityItem> Items { get; set; } = [];
}

internal sealed class WireActivityItem
{
    /// <summary>Activity name; empty string when the user did not name one.</summary>
    public string? Name { get; set; }

    /// <summary>Duration in minutes ("min").</summary>
    public decimal? Min { get; set; }

    /// <summary>Estimated MET value.</summary>
    public decimal? Met { get; set; }

    /// <summary>ONLY calories the user explicitly stated (smart-watch path).</summary>
    public decimal? Kcal { get; set; }

    public ParsedActivityItem ToParsedActivityItem() => new()
    {
        ActivityName = Name ?? string.Empty,
        DurationMinutes = Min,
        MetValue = Met,
        CaloriesKcal = Kcal
    };
}

internal sealed class WireCombinedResponse
{
    public List<WireFoodItem> Foods { get; set; } = [];
    public List<WireActivityItem> Acts { get; set; } = [];
}

internal sealed class WireMetResponse
{
    public decimal Met { get; set; }
    public string? Why { get; set; }
}
