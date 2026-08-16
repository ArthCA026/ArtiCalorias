namespace Articalorias.Models.Entities;

public class User
{
    public long UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? PasswordSalt { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];

    public string? PasswordResetToken { get; set; }
    public DateTime? PasswordResetTokenExpiresAtUtc { get; set; }

    /// <summary>
    /// Last time the user actively opened the app (heartbeat from a visible
    /// session). NULL = never recorded (pre-feature accounts and brand-new
    /// users before their first heartbeat). Drives the auto-add pause: no
    /// template is auto-added to a new day when this is older than
    /// <see cref="Services.DailyLogService.AutoAddPauseAfterDays"/>.
    /// </summary>
    public DateTime? LastActiveAtUtc { get; set; }

    // Navigation
    public UserProfile? UserProfile { get; set; }
    public ICollection<DailyLog> DailyLogs { get; set; } = [];
    public ICollection<ActivityTemplate> ActivityTemplates { get; set; } = [];
    public ICollection<FoodTemplate> FoodTemplates { get; set; } = [];
    public ICollection<FavoriteRoutine> FavoriteRoutines { get; set; } = [];
    public ICollection<MonthlySummary> MonthlySummaries { get; set; } = [];
    public ICollection<PushSubscription> PushSubscriptions { get; set; } = [];
    public ICollection<NotificationSchedule> NotificationSchedules { get; set; } = [];
}
