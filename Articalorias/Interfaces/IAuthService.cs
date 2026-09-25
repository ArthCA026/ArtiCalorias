using Articalorias.DTOs.Auth;

namespace Articalorias.Interfaces;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken ct = default);

    /// <param name="clientIp">Caller address for the failed-login log line; may be null.</param>
    Task<AuthResponse> LoginAsync(LoginRequest request, string? clientIp, CancellationToken ct = default);

    Task ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken ct = default);
    Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken ct = default);
    Task<AuthResponse> RefreshTokenAsync(string refreshToken, CancellationToken ct = default);
    Task RevokeRefreshTokenAsync(string refreshToken, CancellationToken ct = default);

    /// <summary>
    /// Signed-in password change. Verifies the current password, stores the
    /// new hash, signs out every other session and returns fresh tokens for
    /// this one.
    /// </summary>
    Task<AuthResponse> ChangePasswordAsync(long userId, ChangePasswordRequest request, CancellationToken ct = default);

    /// <summary>
    /// Re-authentication for destructive actions. Throws INVALID_PASSWORD
    /// (or TOO_MANY_ATTEMPTS) instead of returning false so callers cannot
    /// forget to check.
    /// </summary>
    Task VerifyPasswordAsync(long userId, string password, CancellationToken ct = default);
}
