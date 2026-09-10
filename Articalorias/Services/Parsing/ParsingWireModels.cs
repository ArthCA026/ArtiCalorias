using Articalorias.DTOs.ActivityParsing;
using Articalorias.DTOs.FoodParsing;

namespace Articalorias.Services.Parsing;

// Wire-level DTOs matching the terse JSON the model returns. Output tokens are
// the expensive ones (6x input price), so the wire schema uses one-letter and
// abbreviated keys; these types translate back to the app's real DTOs.

internal sealed class WireFoodResponse
{
    public List<WireFoodItem> Items { get; set; } = [];
}

internal sealed class WireFoodItem
{
    /// <summary>Food name.</summary>
    public string? N { get; set; }

    /// <summary>Portion description of ONE unit.</summary>
    public string? U { get; set; }

    /// <summary>Quantity of units.</summary>
    public decimal? Q { get; set; }

    public decimal Kcal { get; set; }
    public decimal P { get; set; }
    public decimal F { get; set; }
    public decimal C { get; set; }
    public decimal Alc { get; set; }

    /// <summary>Sugar grams; only present when the user tracks sugar.</summary>
    public decimal? Sug { get; set; }

    /// <summary>Fluid milliliters; only present when the user tracks water.</summary>
    public decimal? H2o { get; set; }

    public ParsedFoodItem ToParsedFoodItem() => new()
    {
        FoodName = N ?? string.Empty,
        PortionDescription = U,
        Quantity = Q,
        CaloriesKcal = Kcal,
        ProteinGrams = P,
        FatGrams = F,
        CarbsGrams = C,
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
    public string? N { get; set; }

    /// <summary>Duration in minutes.</summary>
    public decimal? Min { get; set; }

    /// <summary>Estimated MET value.</summary>
    public decimal? Met { get; set; }

    /// <summary>ONLY calories the user explicitly stated (smart-watch path).</summary>
    public decimal? Kcal { get; set; }

    public ParsedActivityItem ToParsedActivityItem() => new()
    {
        ActivityName = N ?? string.Empty,
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
