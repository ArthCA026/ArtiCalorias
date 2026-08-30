using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.FoodEntries;

/// <summary>Multi-select delete: the day's entries chosen in the UI.</summary>
public class DeleteFoodEntriesRequest
{
    [MinLength(1)]
    [MaxLength(200)]
    public List<long> FoodEntryIds { get; set; } = [];
}
