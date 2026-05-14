using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Activities;

public class UpdateActivityEntryRequest
{
    [Required]
    [StringLength(200)]
    public string ActivityName { get; set; } = string.Empty;

    [Range(0, 1440)]
    public decimal? DurationMinutes { get; set; }

    [Range(0.5, 50)]
    public decimal? METValue { get; set; }
}
