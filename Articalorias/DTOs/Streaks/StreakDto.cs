namespace Articalorias.DTOs.Streaks;

public record StreakDto
{
    public bool StreakEnabled { get; init; }
    public int CurrentStreak { get; init; }
    public int LongestStreak { get; init; }
    public DateOnly? LastLoggedDate { get; init; }
}
