using Articalorias.DTOs.Favorites;
using Articalorias.DTOs.FoodParsing;

namespace Articalorias.Interfaces;

/// <summary>
/// Parses free text that may contain foods, activities, or both — in ONE
/// OpenAI call. Exists so the type-agnostic favorites parse stops paying for
/// two parallel model calls per request.
/// </summary>
public interface ICombinedParsingService
{
    /// <param name="options">Optional macros to extract for the food side (the user's tracked macros).</param>
    Task<CombinedParseResult> ParseAsync(string freeText, FoodParsingOptions? options = null);
}
