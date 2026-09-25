using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Auth;

public class ChangePasswordRequest
{
    [Required]
    [StringLength(100)]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required]
    [StringLength(100, MinimumLength = 8)]
    public string NewPassword { get; set; } = string.Empty;
}
