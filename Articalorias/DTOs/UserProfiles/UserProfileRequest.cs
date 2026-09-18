using System.ComponentModel.DataAnnotations;
using Articalorias.Services;

namespace Articalorias.DTOs.UserProfiles;

public class UserProfileRequest
{
    [Range(0.1, 500)]
    public decimal? CurrentWeightKg { get; set; }

    [Range(1, 300)]
    public decimal? HeightCm { get; set; }

    [Range(1, 150)]
    public int? Age { get; set; }

    [StringLength(1)]
    public string? BiologicalSex { get; set; }  // "M" or "F"

    [Range(0, 10000)]
    public decimal? BMRKcal { get; set; }

    [Range(0, 100)]
    public decimal? BodyFatPercent { get; set; }

    public bool AutoCalculateBMR { get; set; }
    public bool AutoCalculateBodyFat { get; set; }

    [Range(-5000, 10000)]
    public decimal? DailyBaseGoalKcal { get; set; }

    // Protein targets moved to PUT /api/macropreferences (macroKey "protein").

    // Optional "reach X by DATE" goal metadata behind DailyBaseGoalKcal.
    // At most one of weight / body fat may be set, always alongside a date.
    [Range(0.1, 500)]
    public decimal? GoalTargetWeightKg { get; set; }

    [Range(1, 75)]
    public decimal? GoalTargetBodyFatPercent { get; set; }

    public DateOnly? GoalTargetDate { get; set; }

    [StringLength(100)]
    public string? Country { get; set; }

    [StringLength(50)]
    public string? TimeZoneId { get; set; }

    // Display preferences
    [StringLength(20)]
    public string CalorieDisplayMode { get; set; } = "adjusted";

    // Safety settings
    public bool MinCaloriesSafeguardEnabled { get; set; } = false;

    // Sleep & everyday movement (NEAT) hours. Same per-field limits as the
    // editor in the app; the joint "at most 23 h together" rule is checked
    // by the service and answered with SLEEP_NEAT_HOURS_EXCEEDED.
    [Range(0, ExpenditureModel.MaxSleepHours)]
    public decimal SleepHours { get; set; } = ExpenditureModel.DefaultSleepHours;

    [Range(0, ExpenditureModel.MaxNeatHours)]
    public decimal NeatHours { get; set; } = ExpenditureModel.DefaultNeatHours;
}
