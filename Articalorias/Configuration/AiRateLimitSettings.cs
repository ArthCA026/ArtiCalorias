namespace Articalorias.Configuration;

/// <summary>
/// Per-user quotas for the AI parsing endpoints. Every parse is a paid OpenAI
/// call, so a buggy or malicious client must hit a wall long before it hurts
/// the bill. Windows are anchored at each user's first request (not calendar
/// days), so behavior is identical in every time zone.
/// </summary>
public class AiRateLimitSettings
{
    public const string SectionName = "AiRateLimit";

    /// <summary>Max AI requests per user per rolling minute.</summary>
    public int PerMinute { get; set; } = 10;

    /// <summary>Max AI requests per user per rolling 24 hours.</summary>
    public int PerDay { get; set; } = 150;
}
