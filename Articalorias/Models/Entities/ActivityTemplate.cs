namespace Articalorias.Models.Entities;

public class ActivityTemplate
{
    public long ActivityTemplateId { get; set; }
    public long? UserId { get; set; }
    public string TemplateScope { get; set; } = "USER";
    public string ActivityType { get; set; } = "MET_SIMPLE";

    public string TemplateName { get; set; } = string.Empty;

    public bool AutoAddToNewDay { get; set; }
    public bool IsActive { get; set; }

    // Defaults opcionales
    public decimal? DefaultDurationMinutes { get; set; }
    public decimal? DefaultDirectCaloriesKcal { get; set; }
    public decimal? DefaultMET { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];

    // Navigation
    public User? User { get; set; }
    public ICollection<ActivityTemplateSegment> Segments { get; set; } = [];
    public ICollection<ActivityEntry> ActivityEntries { get; set; } = [];
}
