using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.FoodParsing;

public class ParseFoodRequest
{
    [Required]
    [StringLength(2000, MinimumLength = 2)]
    public string FreeText { get; set; } = string.Empty;
}
