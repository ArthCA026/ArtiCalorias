namespace Articalorias.DTOs.Activities;

public class ActivityTemplateResponse
{
    public long ActivityTemplateId { get; set; }
    public string TemplateScope { get; set; } = string.Empty;
    public string ActivityType { get; set; } = string.Empty;
    public string TemplateName { get; set; } = string.Empty;
    public bool AutoAddToNewDay { get; set; }
    public bool IsActive { get; set; }
    public decimal? DefaultDurationMinutes { get; set; }
    public decimal? DefaultMET { get; set; }
    public List<ActivityTemplateSegmentDto> Segments { get; set; } = [];
}
