using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Auth;

/// <summary>Body of the destructive account endpoints: the user's current password.</summary>
public class ConfirmPasswordRequest
{
    [Required]
    [StringLength(100)]
    public string Password { get; set; } = string.Empty;
}
