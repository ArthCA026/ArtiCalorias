using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Articalorias.Configuration;
using Articalorias.Data;
using Articalorias.DTOs.Auth;
using Articalorias.Exceptions;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Articalorias.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly JwtSettings _jwt;
    private readonly IEmailService _emailService;
    private readonly IMemoryCache _cache;
    private readonly MemoryRateCounter _counter;
    private readonly ILogger<AuthService> _logger;

    // ── Password reset ──
    private const int ResendCooldownSeconds = 60;
    private const int MaxForgotRequestsPerHour = 3;
    private const int MaxVerificationAttempts = 5;
    private const int ResetTokenLifetimeMinutes = 15;

    // ── Credential guessing ──
    // Per account identifier, on top of the per-IP limits in RateLimitingExtensions,
    // so a distributed guesser still runs into a wall on the account itself.
    private const int MaxPasswordFailures = 10;
    private static readonly TimeSpan PasswordFailureWindow = TimeSpan.FromMinutes(15);

    // ── Password hashing ──
    // PBKDF2-HMAC-SHA256 at the OWASP 2023 iteration count. Stored self-describing
    // so parameters can be raised later and old rows rehashed on their next login.
    private const string Pbkdf2Prefix = "pbkdf2";
    private const int Pbkdf2Iterations = 600_000;
    private const int Pbkdf2SaltBytes = 16;
    private const int Pbkdf2HashBytes = 32;

    public AuthService(
        AppDbContext db,
        IOptions<JwtSettings> jwt,
        IEmailService emailService,
        IMemoryCache cache,
        MemoryRateCounter counter,
        ILogger<AuthService> logger)
    {
        _db = db;
        _jwt = jwt.Value;
        _emailService = emailService;
        _cache = cache;
        _counter = counter;
        _logger = logger;
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        ValidateRegistrationConsents(request);

        var username = request.Username.Trim();
        var email = request.Email.Trim();

        // One generic answer for both collisions: telling the caller that an
        // email is taken would let anyone test which addresses have accounts.
        var taken = await _db.Users.AnyAsync(u => u.Username == username || u.Email == email, ct);
        if (taken)
            throw new ApiException(ErrorCodes.RegistrationRejected,
                "That username or email can't be used. Try another, or sign in if you already have an account.");

        var user = new User
        {
            Username = username,
            Email = email,
            PasswordHash = CreatePasswordHash(request.Password),
            PasswordSalt = null,
            IsActive = true
        };

        _db.Users.Add(user);

        // Consent evidence shares the SaveChanges with the account row: no
        // account can exist without it, and no orphan rows if creation fails.
        var locale = ConsentLocales.Normalize(request.ConsentLocale);
        foreach (var (type, version) in PolicyVersions.Current)
        {
            _db.UserConsents.Add(new UserConsent
            {
                User = user,
                ConsentType = type,
                PolicyVersion = version,
                Action = ConsentActions.Granted,
                Locale = locale,
                Source = ConsentSources.Register
            });
        }

        await _db.SaveChangesAsync(ct);

        return await GenerateAuthResponseAsync(user, ct);
    }

    /// <summary>
    /// Registration requires all three consents (Ley 8968: terms, privacy
    /// notice, and the separate express health-data consent) at the current
    /// document versions. Client-side checkboxes are UX; this is the rule.
    /// </summary>
    private static void ValidateRegistrationConsents(RegisterRequest request)
    {
        if (string.IsNullOrEmpty(request.AcceptedTermsVersion) ||
            string.IsNullOrEmpty(request.AcceptedPrivacyVersion) ||
            string.IsNullOrEmpty(request.AcceptedHealthDataVersion))
        {
            throw new ApiException(ErrorCodes.ConsentRequired,
                "Creating an account requires accepting the terms, the privacy notice, and health data processing.");
        }

        if (request.AcceptedTermsVersion != PolicyVersions.Terms ||
            request.AcceptedPrivacyVersion != PolicyVersions.Privacy ||
            request.AcceptedHealthDataVersion != PolicyVersions.HealthData)
        {
            throw new ApiException(ErrorCodes.ConsentVersionStale,
                "The accepted document versions are out of date. Please reload the app and review the current versions.");
        }
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request, string? clientIp, CancellationToken ct = default)
    {
        var identifier = request.UsernameOrEmail.Trim();
        var failureKey = $"login-fail:{identifier.ToLowerInvariant()}";

        if (_counter.IsExhausted(failureKey, MaxPasswordFailures, out var retryAfter))
        {
            _logger.LogWarning("Login lockout active for {Identifier} from {Ip} (retry in {RetryAfter})",
                identifier, clientIp ?? "unknown", retryAfter);
            throw new ApiException(ErrorCodes.TooManyAttempts,
                "Too many failed sign-in attempts. Please wait a few minutes and try again.",
                StatusCodes.Status429TooManyRequests);
        }

        var user = await _db.Users.FirstOrDefaultAsync(u =>
            u.Username == identifier || u.Email == identifier, ct);

        // Same work and same answer whether the account exists or not.
        var verified = user is not null
            && user.IsActive
            && VerifyPasswordHash(request.Password, user.PasswordHash, user.PasswordSalt);

        if (!verified)
        {
            _counter.Record(failureKey, PasswordFailureWindow);
            _logger.LogWarning("Failed login for {Identifier} from {Ip}", identifier, clientIp ?? "unknown");
            throw new UnauthorizedAccessException("Invalid credentials.");
        }

        _counter.Reset(failureKey);

        // Transparent upgrade: rows still on the legacy HMAC format move to
        // PBKDF2 the moment the user proves the password. Saved with the
        // refresh token below.
        if (!IsPbkdf2(user!.PasswordHash))
        {
            user.PasswordHash = CreatePasswordHash(request.Password);
            user.PasswordSalt = null;
        }

        return await GenerateAuthResponseAsync(user, ct);
    }

    public async Task ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken ct = default)
    {
        var email = request.Email.Trim();
        var normalizedEmail = email.ToLowerInvariant();
        var cooldownKey = $"resend-cooldown:{normalizedEmail}";
        var hourlyKey = $"forgot-count:{normalizedEmail}";

        // Both throttles run before the lookup and regardless of whether the
        // email exists, so their behaviour never says anything about accounts.
        if (_cache.TryGetValue(cooldownKey, out _))
            throw new ApiException(ErrorCodes.ResendCooldown, "Please wait before requesting another code.",
                StatusCodes.Status429TooManyRequests);

        if (!_counter.TryConsume(hourlyKey, MaxForgotRequestsPerHour, TimeSpan.FromHours(1), out _))
            throw new ApiException(ErrorCodes.ResendCooldown, "Too many reset requests for this address. Please try again later.",
                StatusCodes.Status429TooManyRequests);

        _cache.Set(cooldownKey, true, TimeSpan.FromSeconds(ResendCooldownSeconds));

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
        if (user is null || !user.IsActive)
            return;

        var code = GenerateResetCode();
        user.PasswordResetToken = HashResetCode(user.UserId, code);
        user.PasswordResetTokenExpiresAtUtc = DateTime.UtcNow.AddMinutes(ResetTokenLifetimeMinutes);
        await _db.SaveChangesAsync(ct);

        // NOTE: the verification-attempt counter is deliberately NOT reset
        // here. Requesting a fresh code must not hand out fresh guesses.

        try
        {
            await _emailService.SendPasswordResetEmailAsync(user.Email, code, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Password reset email could not be delivered for user {UserId}.", user.UserId);

            // The code never reached the user: don't leave a live token behind.
            // The cooldown stays and the response stays 200: an error only for
            // real accounts would turn a mail outage into an account oracle.
            user.PasswordResetToken = null;
            user.PasswordResetTokenExpiresAtUtc = null;
            await _db.SaveChangesAsync(CancellationToken.None);
        }
    }

    public async Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken ct = default)
    {
        var email = request.Email.Trim();
        var attemptsKey = $"reset-attempts:{email.ToLowerInvariant()}";

        if (_counter.IsExhausted(attemptsKey, MaxVerificationAttempts, out _))
            throw new ApiException(ErrorCodes.TooManyAttempts, "Too many failed attempts. Please request a new code later.",
                StatusCodes.Status429TooManyRequests);

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);

        // One failure path for "no such user", "no code issued" and "wrong
        // code": the counter moves and the message is the same.
        if (user is null || string.IsNullOrEmpty(user.PasswordResetToken))
            throw RecordResetFailure(attemptsKey, ErrorCodes.CodeInvalid, "Invalid or expired reset code.");

        if (user.PasswordResetTokenExpiresAtUtc is null || user.PasswordResetTokenExpiresAtUtc < DateTime.UtcNow)
            throw RecordResetFailure(attemptsKey, ErrorCodes.CodeExpired, "This code has expired. Please request a new one.");

        if (!ResetCodeMatches(user.UserId, request.Token, user.PasswordResetToken))
            throw RecordResetFailure(attemptsKey, ErrorCodes.CodeInvalid, "That code doesn't match. Please check and try again.");

        // Success: new hash, code consumed, and every existing session ended.
        // A reset is how a user takes an account back; a stolen refresh token
        // must not outlive it.
        user.PasswordHash = CreatePasswordHash(request.NewPassword);
        user.PasswordSalt = null;
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpiresAtUtc = null;

        await RevokeAllRefreshTokensAsync(user.UserId, ct);
        await _db.SaveChangesAsync(ct);

        _counter.Reset(attemptsKey);
        _cache.Remove($"resend-cooldown:{email.ToLowerInvariant()}");
        _counter.Reset($"login-fail:{email.ToLowerInvariant()}");
        _counter.Reset($"login-fail:{user.Username.ToLowerInvariant()}");
    }

    private ApiException RecordResetFailure(string attemptsKey, string errorCode, string message)
    {
        _counter.Record(attemptsKey, TimeSpan.FromMinutes(ResetTokenLifetimeMinutes));
        return new ApiException(errorCode, message);
    }

    public async Task<AuthResponse> ChangePasswordAsync(long userId, ChangePasswordRequest request, CancellationToken ct = default)
    {
        var user = await RequireUserWithPasswordAsync(userId, request.CurrentPassword, ct);

        user.PasswordHash = CreatePasswordHash(request.NewPassword);
        user.PasswordSalt = null;

        // Other devices are signed out; this one gets fresh tokens below.
        await RevokeAllRefreshTokensAsync(user.UserId, ct);
        return await GenerateAuthResponseAsync(user, ct);
    }

    public async Task VerifyPasswordAsync(long userId, string password, CancellationToken ct = default)
    {
        await RequireUserWithPasswordAsync(userId, password, ct);
    }

    /// <summary>
    /// Re-authentication for sensitive actions on an already signed-in
    /// session (change password, delete data). Wrong answers are throttled per
    /// account like a login, so a stolen access token cannot guess its way in.
    /// </summary>
    private async Task<User> RequireUserWithPasswordAsync(long userId, string password, CancellationToken ct)
    {
        var failureKey = $"login-fail:user:{userId}";
        if (_counter.IsExhausted(failureKey, MaxPasswordFailures, out _))
            throw new ApiException(ErrorCodes.TooManyAttempts,
                "Too many failed attempts. Please wait a few minutes and try again.",
                StatusCodes.Status429TooManyRequests);

        var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == userId && u.IsActive, ct)
            ?? throw new UnauthorizedAccessException("Invalid credentials.");

        if (!VerifyPasswordHash(password, user.PasswordHash, user.PasswordSalt))
        {
            _counter.Record(failureKey, PasswordFailureWindow);
            _logger.LogWarning("Password re-authentication failed for user {UserId}", userId);
            throw new ApiException(ErrorCodes.InvalidPassword, "That password is incorrect.");
        }

        _counter.Reset(failureKey);
        return user;
    }

    public async Task<AuthResponse> RefreshTokenAsync(string refreshToken, CancellationToken ct = default)
    {
        var tokenHash = HashRefreshToken(refreshToken);

        var stored = await _db.RefreshTokens
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.TokenHash == tokenHash, ct);

        if (stored is null || stored.RevokedAtUtc is not null || stored.ExpiresAtUtc <= DateTime.UtcNow)
            throw new UnauthorizedAccessException("Invalid or expired refresh token.");

        if (!stored.User.IsActive)
            throw new UnauthorizedAccessException("Invalid or expired refresh token.");

        // Revoke the used token (rotation — one-time use)
        stored.RevokedAtUtc = DateTime.UtcNow;

        // Generate new access + refresh tokens (saves changes internally)
        return await GenerateAuthResponseAsync(stored.User, ct);
    }

    public async Task RevokeRefreshTokenAsync(string refreshToken, CancellationToken ct = default)
    {
        var tokenHash = HashRefreshToken(refreshToken);

        var stored = await _db.RefreshTokens
            .FirstOrDefaultAsync(r => r.TokenHash == tokenHash && r.RevokedAtUtc == null, ct);

        if (stored is not null)
        {
            stored.RevokedAtUtc = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);
        }
    }

    private async Task RevokeAllRefreshTokensAsync(long userId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        await _db.RefreshTokens
            .Where(r => r.UserId == userId && r.RevokedAtUtc == null)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.RevokedAtUtc, now), ct);
    }

    private async Task<AuthResponse> GenerateAuthResponseAsync(User user, CancellationToken ct)
    {
        // --- Access token ---
        var accessExpires = DateTime.UtcNow.AddMinutes(_jwt.ExpirationMinutes);

        // Only what authorization needs. The email used to ride along as a
        // claim; nothing read it, and a token is copied into more places
        // (logs, dev tools) than an identifier should be.
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new Claim(ClaimTypes.Name, user.Username)
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.SecretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var jwtToken = new JwtSecurityToken(
            issuer: _jwt.Issuer,
            audience: _jwt.Audience,
            claims: claims,
            expires: accessExpires,
            signingCredentials: creds);

        var accessToken = new JwtSecurityTokenHandler().WriteToken(jwtToken);

        // --- Refresh token ---
        var rawRefreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var refreshExpires = DateTime.UtcNow.AddDays(_jwt.RefreshTokenExpirationDays);

        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.UserId,
            TokenHash = HashRefreshToken(rawRefreshToken),
            ExpiresAtUtc = refreshExpires
        });

        // Lazy cleanup: remove expired/revoked tokens for this user
        var stale = await _db.RefreshTokens
            .Where(r => r.UserId == user.UserId &&
                        (r.ExpiresAtUtc <= DateTime.UtcNow || r.RevokedAtUtc != null))
            .ToListAsync(ct);
        _db.RefreshTokens.RemoveRange(stale);

        await _db.SaveChangesAsync(ct);

        return new AuthResponse
        {
            UserId = user.UserId,
            Username = user.Username,
            Token = accessToken,
            ExpiresAtUtc = accessExpires,
            RefreshToken = rawRefreshToken,
            RefreshTokenExpiresAtUtc = refreshExpires
        };
    }

    private static string HashRefreshToken(string rawToken)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToBase64String(bytes);
    }

    // ── Password hashing ──

    /// <summary>Format: pbkdf2$sha256$&lt;iterations&gt;$&lt;saltB64&gt;$&lt;hashB64&gt;</summary>
    private static string CreatePasswordHash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(Pbkdf2SaltBytes);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Pbkdf2Iterations, HashAlgorithmName.SHA256, Pbkdf2HashBytes);
        return $"{Pbkdf2Prefix}$sha256${Pbkdf2Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    private static bool IsPbkdf2(string storedHash)
        => storedHash.StartsWith(Pbkdf2Prefix + "$", StringComparison.Ordinal);

    private static bool VerifyPasswordHash(string password, string storedHash, string? legacySalt)
    {
        if (IsPbkdf2(storedHash))
            return VerifyPbkdf2(password, storedHash);

        // Legacy rows: HMACSHA512(password) keyed by the per-user salt, both
        // base64. Kept only until the row is rehashed on its next login.
        if (string.IsNullOrEmpty(legacySalt))
            return false;

        byte[] saltBytes;
        byte[] expected;
        try
        {
            saltBytes = Convert.FromBase64String(legacySalt);
            expected = Convert.FromBase64String(storedHash);
        }
        catch (FormatException)
        {
            return false;
        }

        using var hmac = new HMACSHA512(saltBytes);
        var computed = hmac.ComputeHash(Encoding.UTF8.GetBytes(password));
        return CryptographicOperations.FixedTimeEquals(computed, expected);
    }

    private static bool VerifyPbkdf2(string password, string storedHash)
    {
        var parts = storedHash.Split('$');
        if (parts.Length != 5 || parts[1] != "sha256" || !int.TryParse(parts[2], out var iterations) || iterations <= 0)
            return false;

        byte[] salt;
        byte[] expected;
        try
        {
            salt = Convert.FromBase64String(parts[3]);
            expected = Convert.FromBase64String(parts[4]);
        }
        catch (FormatException)
        {
            return false;
        }

        var computed = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
        return CryptographicOperations.FixedTimeEquals(computed, expected);
    }

    // ── Reset codes ──

    private static string GenerateResetCode()
        => RandomNumberGenerator.GetInt32(100_000, 1_000_000).ToString();

    /// <summary>
    /// The column holds an HMAC of the code, not the code: a database read
    /// (backup, dump, curious operator) no longer yields live reset codes.
    /// Keyed by the JWT secret and bound to the user id so a hash cannot be
    /// moved between accounts.
    /// </summary>
    private string HashResetCode(long userId, string code)
    {
        var key = Encoding.UTF8.GetBytes(_jwt.SecretKey);
        var mac = HMACSHA256.HashData(key, Encoding.UTF8.GetBytes($"{userId}:{code}"));
        return Convert.ToBase64String(mac);
    }

    private bool ResetCodeMatches(long userId, string presentedCode, string storedHash)
    {
        var presented = Encoding.UTF8.GetBytes(HashResetCode(userId, presentedCode.Trim()));
        var stored = Encoding.UTF8.GetBytes(storedHash);
        return CryptographicOperations.FixedTimeEquals(presented, stored);
    }
}
