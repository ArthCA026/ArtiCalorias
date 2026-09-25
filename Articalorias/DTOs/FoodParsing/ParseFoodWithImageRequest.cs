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

    /// <summary>6 MB of image, expressed as the base64 length that carries it (4 chars per 3 bytes).</summary>
    public const long MaxImageBytes = 6 * 1024 * 1024;
    public const int MaxBase64Length = (int)(MaxImageBytes / 3 * 4) + 4;

    [Required]
    [StringLength(MaxBase64Length)]
    public string ImageBase64 { get; set; } = string.Empty;

    [Required]
    public string MimeType { get; set; } = string.Empty;

    [StringLength(500)]
    public string? FreeText { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (!AllowedMimeTypes.Contains(MimeType))
        {
            yield return new ValidationResult(
                "Unsupported image type. Use JPEG, PNG, WebP, or GIF.",
                [nameof(MimeType)]);
            yield break;
        }

        if (string.IsNullOrEmpty(ImageBase64))
            yield break;

        // The bytes are relayed to a third party, so the declared type has to
        // match what is actually inside: decode just the header and check the
        // magic bytes instead of trusting the client's MIME string.
        var headerLength = Math.Min(ImageBase64.Length, 32);
        headerLength -= headerLength % 4;
        var header = DecodeHeader(ImageBase64[..headerLength]);
        if (header is null)
        {
            yield return new ValidationResult("Image data is not valid base64.", [nameof(ImageBase64)]);
            yield break;
        }

        if (!LooksLike(header, MimeType))
            yield return new ValidationResult(
                "Image data does not match the declared image type.",
                [nameof(ImageBase64)]);
    }

    private static byte[]? DecodeHeader(string base64Prefix)
    {
        try
        {
            return Convert.FromBase64String(base64Prefix);
        }
        catch (FormatException)
        {
            return null;
        }
    }

    private static readonly byte[] PngMagic = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    private static bool LooksLike(ReadOnlySpan<byte> header, string mimeType) => mimeType switch
    {
        "image/jpeg" => header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF,
        "image/png" => header.Length >= 8 && header[..8].SequenceEqual(PngMagic),
        "image/gif" => header.Length >= 6 && header[..3].SequenceEqual("GIF"u8),
        "image/webp" => header.Length >= 12 && header[..4].SequenceEqual("RIFF"u8) && header[8..12].SequenceEqual("WEBP"u8),
        _ => false
    };
}
