using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Activities;

public class CreateActivityEntryRequest
{
    public long? ActivityTemplateId { get; set; }

    [Required]
    [StringLength(20)]
    public string ActivityType { get; set; } = "MET_SIMPLE";

    [Required]
    [StringLength(200)]
    public string ActivityName { get; set; } = string.Empty;

    [Range(0, 1440)]
    public decimal? DurationMinutes { get; set; }

    [Range(0.5, 50)]
    public decimal? METValue { get; set; }

    [StringLength(500)]
    public string? Notes { get; set; }

    public List<ActivityEntrySegmentDto> Segments { get; set; } = [];
}
