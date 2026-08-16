namespace Articalorias.Services;

/// <summary>
/// The one place that turns "now" into a user's local calendar date.
/// Users live in their own timezone, never the server's: every "today"
/// decision (auto-add, streaks, measurement dates) must go through here.
/// </summary>
public static class LocalDates
{
    /// <summary>
    /// The user's local calendar date right now. Unknown or invalid timezone
    /// ids fall back to UTC (same behavior as StreakService and reminders).
    /// </summary>
    public static DateOnly TodayFor(string? timeZoneId, DateTime? utcNow = null)
    {
        var now = utcNow ?? DateTime.UtcNow;
        TimeZoneInfo tz;
        try { tz = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId ?? "UTC"); }
        catch (TimeZoneNotFoundException) { tz = TimeZoneInfo.Utc; }
        catch (InvalidTimeZoneException) { tz = TimeZoneInfo.Utc; }
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(now, tz));
    }

    /// <summary>
    /// Resolves "today" preferring the client's own calendar date (the device
    /// always knows it exactly) within a ±2 day sanity window around UTC now,
    /// falling back to the stored profile timezone. Same rule as the routines
    /// quick-add and the fasting endpoint, centralized.
    /// </summary>
    public static DateOnly Resolve(DateOnly? clientToday, string? timeZoneId)
    {
        var utcToday = DateOnly.FromDateTime(DateTime.UtcNow);
        if (clientToday.HasValue && Math.Abs(clientToday.Value.DayNumber - utcToday.DayNumber) <= 2)
            return clientToday.Value;
        return TodayFor(timeZoneId);
    }
}
