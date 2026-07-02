namespace Articalorias.Models.Entities;

public class UserStreak
{
    public long UserStreakId { get; set; }
    public long UserId { get; set; }
    public bool StreakEnabled { get; set; } = true;
    public int CurrentStreak { get; set; }
    public int LongestStreak { get; set; }
    public DateOnly? LastLoggedDate { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];

    // Navigation
    public User User { get; set; } = null!;
}
