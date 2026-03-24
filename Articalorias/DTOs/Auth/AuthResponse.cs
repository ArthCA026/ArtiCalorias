namespace Articalorias.DTOs.Auth;

public class AuthResponse
{
    public long UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAtUtc { get; set; }
}
