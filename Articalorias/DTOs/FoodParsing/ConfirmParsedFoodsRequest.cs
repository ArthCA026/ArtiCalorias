using System.ComponentModel.DataAnnotations;
using Articalorias.DTOs.FoodEntries;

namespace Articalorias.DTOs.FoodParsing;

public class ConfirmParsedFoodsRequest
{
    [Required]
    [MinLength(1)]
    public List<CreateFoodEntryRequest> Items { get; set; } = [];
}
