using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.FoodParsing;

public class BarcodeRequest
{
    [Required]
    [StringLength(48, MinimumLength = 1)]
    [RegularExpression(@"^[0-9A-Za-z\-\. \/\$\+\%]+$", ErrorMessage = "Invalid barcode characters.")]
    public string Barcode { get; set; } = string.Empty;
}
