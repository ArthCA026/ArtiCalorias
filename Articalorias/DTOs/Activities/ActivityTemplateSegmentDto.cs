using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Activities;

/// <summary>
/// Segment definition for a MET_MULTIPLE activity template.
/// Maps to ActivityTemplateSegment entity (DefaultDurationMinutes → DurationMinutes).
/// </summary>
public class ActivityTemplateSegmentDto
{
    [Range(1, 100)]
    public int SegmentOrder { get; set; }

    [Required]
    [StringLength(200)]
    public string SegmentName { get; set; } = string.Empty;

    [Range(0.5, 50)]
    public decimal METValue { get; set; }

    [Range(0.1, 1440)]
    public decimal DurationMinutes { get; set; }
}
