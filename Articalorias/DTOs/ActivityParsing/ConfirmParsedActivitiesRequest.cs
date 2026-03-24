using System.ComponentModel.DataAnnotations;
using Articalorias.DTOs.Activities;

namespace Articalorias.DTOs.ActivityParsing;

public class ConfirmParsedActivitiesRequest
{
    [Required]
    [MinLength(1)]
    public List<CreateActivityEntryRequest> Items { get; set; } = [];
}
