using Articalorias.DTOs.ActivityParsing;
using Articalorias.DTOs.FoodParsing;

namespace Articalorias.DTOs.Favorites;

/// <summary>
/// Result of the single-call combined parse: foods and activities extracted
/// from the same free text in one OpenAI request. Either side may be empty —
/// most inputs are only one or the other.
/// </summary>
public class CombinedParseResult
{
    public IReadOnlyList<ParsedFoodItem> Foods { get; init; } = [];
    public IReadOnlyList<ParsedActivityItem> Activities { get; init; } = [];
}
