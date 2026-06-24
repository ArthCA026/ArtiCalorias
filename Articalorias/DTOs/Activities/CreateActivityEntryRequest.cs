using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Activities;

public class CreateActivityEntryRequest
{
    public long? ActivityTemplateId { get; set; }

    [Required]
    [StringLength(200)]
    public string ActivityName { get; set; } = string.Empty;

    [Required]
    [Range(0, 1440)]
    public decimal? DurationMinutes { get; set; }

    [Required]
    [Range(0.5, 50)]
    public decimal? METValue { get; set; }
}
