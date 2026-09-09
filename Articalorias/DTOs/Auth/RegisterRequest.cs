using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Auth;

public class RegisterRequest
{
    [Required]
    [StringLength(50, MinimumLength = 3)]
    public string Username { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [StringLength(200)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [StringLength(100, MinimumLength = 8)]
    public string Password { get; set; } = string.Empty;

    /// <summary>Version of each document the user accepted (Ley 8968). Null
    /// means not accepted; the server rejects the registration outright, so
    /// no account can exist without recorded consent.</summary>
    [StringLength(20)]
    public string? AcceptedTermsVersion { get; set; }

    [StringLength(20)]
    public string? AcceptedPrivacyVersion { get; set; }

    [StringLength(20)]
    public string? AcceptedHealthDataVersion { get; set; }

    /// <summary>UI language the documents were displayed in ("es" | "en").</summary>
    [StringLength(5)]
    public string ConsentLocale { get; set; } = "es";
}
