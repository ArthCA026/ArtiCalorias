namespace Articalorias.Models.Entities;

public class UserProfile
{
    public long UserProfileId { get; set; }
    public long UserId { get; set; }

    // Datos fisiológicos vigentes
    public decimal CurrentWeightKg { get; set; }
    public decimal HeightCm { get; set; }
    public int? Age { get; set; }
    public string? BiologicalSex { get; set; }  // "M" or "F"
    public decimal BMRKcal { get; set; }
    public decimal? BodyFatPercent { get; set; }
    public bool AutoCalculateBMR { get; set; }
    public bool AutoCalculateBodyFat { get; set; }

    // Metas vigentes
    public decimal DailyBaseGoalKcal { get; set; }
    public decimal? ProteinGoalGrams { get; set; }
    public bool AutoCalculateProteinGoal { get; set; }

    public string? Country { get; set; }

    public bool IsOnboardingCompleted { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];

    // Navigation
    public User User { get; set; } = null!;
}
