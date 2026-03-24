using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.UserProfiles;

public class UserProfileRequest
{
    [Range(0.1, 500)]
    public decimal CurrentWeightKg { get; set; }

    [Range(1, 300)]
    public decimal HeightCm { get; set; }

    [Range(1, 150)]
    public int? Age { get; set; }

    [StringLength(1)]
    public string? BiologicalSex { get; set; }  // "M" or "F"

    [Range(1, 10000)]
    public decimal? BMRKcal { get; set; }

    [Range(0, 100)]
    public decimal? BodyFatPercent { get; set; }

    public bool AutoCalculateBMR { get; set; }
    public bool AutoCalculateBodyFat { get; set; }

    [Range(-5000, 10000)]
    public decimal? DailyBaseGoalKcal { get; set; }

    [Range(0, 1000)]
    public decimal? ProteinGoalGrams { get; set; }

    public bool AutoCalculateProteinGoal { get; set; }

    [StringLength(100)]
    public string? Country { get; set; }
}
