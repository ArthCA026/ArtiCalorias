namespace Articalorias.DTOs.ActivityParsing;

/// <summary>
/// A single activity item proposed by OpenAI parsing.
/// Not persisted until the user confirms.
/// </summary>
public class ParsedActivityItem
{
    public string ActivityName { get; set; } = string.Empty;
    public decimal? DurationMinutes { get; set; }
    public decimal? MetValue { get; set; }

    /// <summary>
    /// Calories the user explicitly stated they burned (e.g. "200 kcal of running").
    /// The parser never computes this; it is only filled when the user said it.
    /// Missing MET/duration math happens server-side on confirm.
    /// </summary>
    public decimal? CaloriesKcal { get; set; }
}
