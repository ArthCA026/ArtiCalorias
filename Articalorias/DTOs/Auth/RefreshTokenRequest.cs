using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Auth;

public class RefreshTokenRequest
{
    [Required]
    public string RefreshToken { get; set; } = string.Empty;
}
