namespace Articalorias.Models.Entities;

public class UserProfile
{
    public long UserProfileId { get; set; }
    public long UserId { get; set; }

    // Datos fisiológicos vigentes
    public decimal? CurrentWeightKg { get; set; }
    public decimal? HeightCm { get; set; }
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

    /// <summary>
    /// Preset multiplier behind an AUTO protein goal (g per kg of body
    /// weight). The effective goal re-derives from the current weight on
    /// every snapshot, so it follows the body. NULL = historical 2.0 g/kg.
    /// See <see cref="Services.ProteinMath"/>.
    /// </summary>
    public decimal? ProteinGoalGramsPerKg { get; set; }

    /// <summary>
    /// Optional "reach X by DATE" goal behind DailyBaseGoalKcal. Purely
    /// motivational metadata: the calorie pipeline only ever reads
    /// DailyBaseGoalKcal, which the UI derives from these when they are set.
    /// Either the weight or the body-fat target is set, never both.
    /// </summary>
    public decimal? GoalTargetWeightKg { get; set; }
    public decimal? GoalTargetBodyFatPercent { get; set; }
    public DateOnly? GoalTargetDate { get; set; }

    public string? Country { get; set; }

    // Display preferences
    public string CalorieDisplayMode { get; set; } = "adjusted";

    // Safety settings
    public bool MinCaloriesSafeguardEnabled { get; set; } = false;

    // Sleep & NEAT fixed daily costs
    public decimal SleepHours { get; set; } = 8.0m;
    public decimal NeatHours { get; set; } = 3.0m;

    public bool IsOnboardingCompleted { get; set; }

    /// <summary>
    /// First time the user themself logged food (manual, AI, barcode, template
    /// or routine — NOT template auto-add). NULL = never logged anything.
    /// Gates the "You are N of 3 steps in" checklist and the first-run tutorial.
    /// </summary>
    public DateTime? FirstFoodLoggedAtUtc { get; set; }

    /// <summary>
    /// The user finished or skipped the first-run interactive tutorial.
    /// Backfilled to true for accounts that existed before the feature.
    /// </summary>
    public bool HasSeenTutorial { get; set; }

    /// <summary>IANA timezone ID (e.g. "America/New_York"). Null → UTC.</summary>
    public string? TimeZoneId { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];

    // Navigation
    public User User { get; set; } = null!;
}
