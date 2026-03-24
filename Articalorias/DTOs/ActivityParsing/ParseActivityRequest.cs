using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.ActivityParsing;

public class ParseActivityRequest
{
    [Required]
    [StringLength(2000, MinimumLength = 2)]
    public string FreeText { get; set; } = string.Empty;
}
