using Articalorias.DTOs.ActivityParsing;
using Articalorias.DTOs.FoodParsing;

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
    public decimal Prot { get; set; }
    public decimal Fat { get; set; }
    public decimal Carb { get; set; }
    public decimal Alc { get; set; }

    /// <summary>Sugar grams; only present when the user tracks sugar.</summary>
    public decimal? Sug { get; set; }

    /// <summary>Fluid milliliters; only present when the user tracks water.</summary>
    public decimal? H2o { get; set; }

    public ParsedFoodItem ToParsedFoodItem() => new()
    {
        FoodName = Name ?? string.Empty,
        PortionDescription = Unit,
        Quantity = Qty,
        CaloriesKcal = Kcal,
        ProteinGrams = Prot,
        FatGrams = Fat,
        CarbsGrams = Carb,
        AlcoholGrams = Alc,
        SugarGrams = Sug,
        WaterMl = H2o
    };
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
