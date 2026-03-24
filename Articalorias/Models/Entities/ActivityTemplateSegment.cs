namespace Articalorias.Models.Entities;

public class ActivityTemplateSegment
{
    public long ActivityTemplateSegmentId { get; set; }
    public long ActivityTemplateId { get; set; }
    public int SegmentOrder { get; set; }
    public string SegmentName { get; set; } = string.Empty;
    public decimal METValue { get; set; }
    public decimal DefaultDurationMinutes { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    // Navigation
    public ActivityTemplate ActivityTemplate { get; set; } = null!;
}
