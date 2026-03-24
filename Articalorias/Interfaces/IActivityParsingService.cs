using Articalorias.DTOs.ActivityParsing;

namespace Articalorias.Interfaces;

/// <summary>
/// Parses free-text activity descriptions into structured activity entries
/// using OpenAI. The backend validates and the user confirms before saving.
/// </summary>
public interface IActivityParsingService
{
    /// <summary>
    /// Sends free text to OpenAI and returns proposed structured activity entries.
    /// These are NOT saved yet — the user reviews and confirms first.
    /// </summary>
    Task<IReadOnlyList<ParsedActivityItem>> ParseFreeTextAsync(string freeText);

    /// <summary>
    /// Estimates the MET value for a given activity name using OpenAI.
    /// </summary>
    Task<EstimateMetResponse> EstimateMetAsync(string activityName, decimal? durationMinutes);
}
