using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Activities;

/// <summary>Multi-select delete: the day's entries chosen in the UI.</summary>
public class DeleteActivityEntriesRequest
{
    [MinLength(1)]
    [MaxLength(200)]
    public List<long> ActivityEntryIds { get; set; } = [];
}
