namespace Articalorias.DTOs.UserProfiles;

public class UserProfileResponse
{
    public long UserProfileId { get; set; }
    public decimal? CurrentWeightKg { get; set; }
    public decimal? HeightCm { get; set; }
    public int? Age { get; set; }
    public string? BiologicalSex { get; set; }
    public decimal BMRKcal { get; set; }
    public decimal? BodyFatPercent { get; set; }
    public bool AutoCalculateBMR { get; set; }
    public bool AutoCalculateBodyFat { get; set; }
    public decimal DailyBaseGoalKcal { get; set; }
    public decimal? ProteinGoalGrams { get; set; }
    public bool AutoCalculateProteinGoal { get; set; }
    /// <summary>Preset g/kg multiplier behind an auto protein goal.</summary>
    public decimal? ProteinGoalGramsPerKg { get; set; }

    // Optional "reach X by DATE" goal metadata behind DailyBaseGoalKcal.
    public decimal? GoalTargetWeightKg { get; set; }
    public decimal? GoalTargetBodyFatPercent { get; set; }
    public DateOnly? GoalTargetDate { get; set; }
    public string? Country { get; set; }
    public bool IsOnboardingCompleted { get; set; }
    /// <summary>The user finished or skipped the first-run tutorial.</summary>
    public bool HasSeenTutorial { get; set; }
    /// <summary>The user has logged food themself at least once, ever.</summary>
    public bool HasEverLoggedFood { get; set; }
    public string? TimeZoneId { get; set; }

    // Display preferences
    public string CalorieDisplayMode { get; set; } = "adjusted";

    // Safety settings
    public bool MinCaloriesSafeguardEnabled { get; set; } = true;

    // Sleep & NEAT fixed daily costs
    public decimal SleepHours { get; set; }
    public decimal NeatHours { get; set; }
}
