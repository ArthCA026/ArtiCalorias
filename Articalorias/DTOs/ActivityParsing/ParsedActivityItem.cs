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
}
