using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Activities;

public class CreateActivityEntryRequest
{
    public long? ActivityTemplateId { get; set; }

    [Required]
    [StringLength(200)]
    public string ActivityName { get; set; } = string.Empty;

    [Range(0, 1440)]
    public decimal? DurationMinutes { get; set; }

    [Range(0.5, 50)]
    public decimal? METValue { get; set; }

    /// <summary>
    /// Burned calories supplied directly by the user (e.g. from a smart watch).
    /// When set, it is stored as the entry's calories and the missing MET or
    /// duration is derived server-side. Without it, MET + duration are required.
    /// </summary>
    [Range(0, 10000)]
    public decimal? CaloriesKcal { get; set; }
}
