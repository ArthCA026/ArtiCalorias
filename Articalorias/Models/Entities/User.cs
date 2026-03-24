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

    // Navigation
    public UserProfile? UserProfile { get; set; }
    public ICollection<DailyLog> DailyLogs { get; set; } = [];
    public ICollection<ActivityTemplate> ActivityTemplates { get; set; } = [];
    public ICollection<WeeklySummary> WeeklySummaries { get; set; } = [];
    public ICollection<MonthlySummary> MonthlySummaries { get; set; } = [];
}
