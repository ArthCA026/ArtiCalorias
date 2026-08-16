namespace Articalorias.DTOs.DailyLogs;

/// <summary>
/// One tracked macro as frozen on a specific day. What the day view renders a
/// progress bar from — past days keep the targets they were lived under, so a
/// macro enabled today never rewrites yesterday's story.
/// </summary>
public class DayMacroTargetResponse
{
    /// <summary>"carbs" | "fat" | "alcohol" | "sugar" | "water"</summary>
    public string MacroKey { get; set; } = string.Empty;

    /// <summary>Grams per day (ml for water). Null = tracked amount-only, no bar.</summary>
    public decimal? Target { get; set; }

    /// <summary>"hit" (a goal to reach) or "limit" (warn when exceeded).</summary>
    public string Direction { get; set; } = "hit";
}
