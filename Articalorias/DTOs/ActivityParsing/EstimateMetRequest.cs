using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.ActivityParsing;

public class EstimateMetRequest
{
    [Required]
    [StringLength(200, MinimumLength = 2)]
    public string ActivityName { get; set; } = string.Empty;

    [Range(0, 1440)]
    public decimal? DurationMinutes { get; set; }
}
