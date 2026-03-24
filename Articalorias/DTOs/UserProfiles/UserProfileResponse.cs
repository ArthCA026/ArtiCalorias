namespace Articalorias.DTOs.UserProfiles;

public class UserProfileResponse
{
    public long UserProfileId { get; set; }
    public decimal CurrentWeightKg { get; set; }
    public decimal HeightCm { get; set; }
    public int? Age { get; set; }
    public string? BiologicalSex { get; set; }
    public decimal BMRKcal { get; set; }
    public decimal? BodyFatPercent { get; set; }
    public bool AutoCalculateBMR { get; set; }
    public bool AutoCalculateBodyFat { get; set; }
    public decimal DailyBaseGoalKcal { get; set; }
    public decimal? ProteinGoalGrams { get; set; }
    public bool AutoCalculateProteinGoal { get; set; }
    public string? Country { get; set; }
    public bool IsOnboardingCompleted { get; set; }
}
