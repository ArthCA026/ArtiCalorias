using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Streaks;

public class UpdateStreakSettingsRequest
{
    [Required]
    public bool StreakEnabled { get; init; }
}
