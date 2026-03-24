namespace Articalorias.DTOs.ActivityParsing;

/// <summary>
/// A single activity item proposed by OpenAI parsing.
/// Not persisted until the user confirms.
/// </summary>
public class ParsedActivityItem
{
    public string ActivityName { get; set; } = string.Empty;
    public string ActivityType { get; set; } = "MET_SIMPLE";
    public decimal? DurationMinutes { get; set; }
    public decimal? MetValue { get; set; }
    public string? Notes { get; set; }
    public List<ParsedActivitySegment> Segments { get; set; } = [];
}

public class ParsedActivitySegment
{
    public int SegmentOrder { get; set; }
    public string SegmentName { get; set; } = string.Empty;
    public decimal MetValue { get; set; }
    public decimal DurationMinutes { get; set; }
}
