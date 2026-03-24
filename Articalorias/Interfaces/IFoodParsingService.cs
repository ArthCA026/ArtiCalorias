using Articalorias.DTOs.FoodParsing;

namespace Articalorias.Interfaces;

/// <summary>
/// Parses free-text food descriptions into structured food entries
/// using OpenAI. The backend validates and the user confirms before saving.
/// </summary>
public interface IFoodParsingService
{
    /// <summary>
    /// Sends free text to OpenAI and returns proposed structured food entries.
    /// These are NOT saved yet — the user reviews and confirms first.
    /// </summary>
    /// <param name="freeText">The free-text food description.</param>
    /// <param name="country">Optional user country for region-specific calorie estimation.</param>
    Task<IReadOnlyList<ParsedFoodItem>> ParseFreeTextAsync(string freeText, string? country = null);
}
