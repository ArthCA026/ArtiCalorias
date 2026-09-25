using System.ComponentModel.DataAnnotations;
using Articalorias.DTOs.FoodEntries;

namespace Articalorias.DTOs.FoodParsing;

public class ConfirmParsedFoodsRequest
{
    /// <summary>Same cap as the delete-batch DTOs: one screen's worth, never a bulk import.</summary>
    [Required]
    [MinLength(1)]
    [MaxLength(200)]
    public List<CreateFoodEntryRequest> Items { get; set; } = [];
}
