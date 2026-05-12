using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.FoodParsing;

public class ParseFoodWithImageRequest : IValidatableObject
{
    private static readonly HashSet<string> AllowedMimeTypes =
    [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
    ];

    [Required]
    public string ImageBase64 { get; set; } = string.Empty;

    [Required]
    public string MimeType { get; set; } = string.Empty;

    [StringLength(500)]
    public string? FreeText { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (!AllowedMimeTypes.Contains(MimeType))
            yield return new ValidationResult(
                "Unsupported image type. Use JPEG, PNG, WebP, or GIF.",
                [nameof(MimeType)]);

        if (!string.IsNullOrEmpty(ImageBase64))
        {
            // Rough byte size estimate: base64 encodes 3 bytes as 4 chars
            var estimatedBytes = (long)(ImageBase64.Length * 0.75);
            const long MaxBytes = 6 * 1024 * 1024; // 6 MB
            if (estimatedBytes > MaxBytes)
                yield return new ValidationResult(
                    "Image is too large. Maximum size is 6 MB.",
                    [nameof(ImageBase64)]);
        }
    }
}
