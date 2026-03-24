namespace Articalorias.Models.Entities;

public class ActivityEntrySegment
{
    public long ActivityEntrySegmentId { get; set; }
    public long ActivityEntryId { get; set; }
    public int SegmentOrder { get; set; }
    public string SegmentName { get; set; } = string.Empty;
    public decimal METValue { get; set; }
    public decimal DurationMinutes { get; set; }
    public decimal CalculatedCaloriesKcal { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    // Navigation
    public ActivityEntry ActivityEntry { get; set; } = null!;
}
