using System.ComponentModel.DataAnnotations;
using Articalorias.DTOs.Activities;

namespace Articalorias.DTOs.ActivityParsing;

public class ConfirmParsedActivitiesRequest
{
    /// <summary>Each item runs a full recalculation, so the cap matters here more than anywhere.</summary>
    [Required]
    [MinLength(1)]
    [MaxLength(200)]
    public List<CreateActivityEntryRequest> Items { get; set; } = [];
}
