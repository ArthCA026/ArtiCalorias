namespace Articalorias.Models.Entities;

public class ActivityEntry
{
    public long ActivityEntryId { get; set; }
    public long DailyLogId { get; set; }
    public long? ActivityTemplateId { get; set; }

    public string ActivityType { get; set; } = "MET_SIMPLE";
    public string ActivityName { get; set; } = string.Empty;

    public decimal? DurationMinutes { get; set; }
    public decimal? DirectCaloriesKcal { get; set; }
    public decimal? METValue { get; set; }

    public decimal CalculatedCaloriesKcal { get; set; }
    public bool IsGlobalDefault { get; set; }
    public string? Notes { get; set; }
    public int SortOrder { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];

    // Navigation
    public DailyLog DailyLog { get; set; } = null!;
    public ActivityTemplate? ActivityTemplate { get; set; }
    public ICollection<ActivityEntrySegment> Segments { get; set; } = [];
}
