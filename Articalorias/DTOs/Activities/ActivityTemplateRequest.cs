using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Activities;

public class ActivityTemplateRequest
{
    [Required]
    [StringLength(10)]
    public string TemplateScope { get; set; } = "USER";

    [Required]
    [StringLength(20)]
    public string ActivityType { get; set; } = "MET_SIMPLE";

    [Required]
    [StringLength(200)]
    public string TemplateName { get; set; } = string.Empty;

    public bool AutoAddToNewDay { get; set; }

    [Range(0, 1440)]
    public decimal? DefaultDurationMinutes { get; set; }

    [Range(0.5, 50)]
    public decimal? DefaultMET { get; set; }

    public List<ActivityTemplateSegmentDto> Segments { get; set; } = [];
}
