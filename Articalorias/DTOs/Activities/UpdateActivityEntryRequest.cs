using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Activities;

public class UpdateActivityEntryRequest
{
    [Required]
    [StringLength(200)]
    public string ActivityName { get; set; } = string.Empty;

    [Range(0, 1440)]
    public decimal? DurationMinutes { get; set; }

    [Range(0.5, 50)]
    public decimal? METValue { get; set; }

    /// <summary>
    /// Burned calories override supplied directly by the user. When set, it is
    /// stored as-is and the MET is re-derived from it; when null, calories are
    /// recomputed from MET × weight × duration as usual.
    /// </summary>
    [Range(0, 10000)]
    public decimal? CaloriesKcal { get; set; }
}
