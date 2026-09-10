using Articalorias.DTOs.Favorites;

namespace Articalorias.Interfaces;

/// <summary>
/// Parses free text that may contain foods, activities, or both — in ONE
/// OpenAI call. Exists so the type-agnostic favorites parse stops paying for
/// two parallel model calls per request.
/// </summary>
public interface ICombinedParsingService
{
    Task<CombinedParseResult> ParseAsync(string freeText);
}
