using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Favorites;

public class ParseFavoriteRequest
{
    [Required]
    [StringLength(500)]
    public string Text { get; set; } = string.Empty;

    /// <summary>
    /// Optional filter: "activity" or "food". When provided only the matching parser runs.
    /// Null (omitted) runs both parsers — backwards-compatible default.
    /// </summary>
    [StringLength(10)]
    public string? Type { get; set; }
}
