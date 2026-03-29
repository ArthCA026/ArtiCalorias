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

    private const int ResendCooldownSeconds = 60;
    private const int MaxVerificationAttempts = 5;
    private const int ResetTokenLifetimeMinutes = 15;

    public AuthService(AppDbContext db, IOptions<JwtSettings> jwt, IEmailService emailService, IMemoryCache cache)
    {
        _db = db;
        _jwt = jwt.Value;
        _emailService = emailService;
        _cache = cache;
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
        if (await _db.Users.AnyAsync(u => u.Username == request.Username))
            throw new InvalidOperationException("Username already exists.");

        if (await _db.Users.AnyAsync(u => u.Email == request.Email))
            throw new InvalidOperationException("Email already exists.");

        CreatePasswordHash(request.Password, out string hash, out string salt);

        var user = new User
        {
            Username = request.Username,
            Email = request.Email,
            PasswordHash = hash,
            PasswordSalt = salt,
            IsActive = true
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return GenerateToken(user);
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request)
    {
        var identifier = request.UsernameOrEmail.Trim();
        var user = await _db.Users.FirstOrDefaultAsync(u =>
            u.Username == identifier || u.Email == identifier);

        if (user is null || !user.IsActive)
            throw new UnauthorizedAccessException("Invalid credentials.");

        if (!VerifyPasswordHash(request.Password, user.PasswordHash, user.PasswordSalt))
            throw new UnauthorizedAccessException("Invalid credentials.");

        return GenerateToken(user);
    }

    public async Task ForgotPasswordAsync(ForgotPasswordRequest request)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var cooldownKey = $"resend-cooldown:{normalizedEmail}";

        // Enforce resend cooldown regardless of whether the email exists (privacy-safe)
        if (_cache.TryGetValue(cooldownKey, out _))
            throw new ApiException(ErrorCodes.ResendCooldown, "Please wait before requesting another code.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email);

        // Always set the cooldown and return success to avoid leaking whether the email exists
        _cache.Set(cooldownKey, true, TimeSpan.FromSeconds(ResendCooldownSeconds));

        if (user is null || !user.IsActive)
            return;

        var token = GenerateResetToken();
        user.PasswordResetToken = token;
        user.PasswordResetTokenExpiresAtUtc = DateTime.UtcNow.AddMinutes(ResetTokenLifetimeMinutes);
        await _db.SaveChangesAsync();

        // Clear any previous verification attempts for this email (fresh code = fresh attempts)
        _cache.Remove($"reset-attempts:{normalizedEmail}");

        await _emailService.SendPasswordResetEmailAsync(user.Email, token);
    }

    public async Task ResetPasswordAsync(ResetPasswordRequest request)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var attemptsKey = $"reset-attempts:{normalizedEmail}";

        // Check verification attempt limit
        var attempts = _cache.GetOrCreate(attemptsKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(ResetTokenLifetimeMinutes);
            return 0;
        });

        if (attempts >= MaxVerificationAttempts)
            throw new ApiException(ErrorCodes.TooManyAttempts, "Too many failed attempts. Please request a new code.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email);

        // Use the same generic message for user-not-found to avoid email enumeration
        if (user is null)
        {
            _cache.Set(attemptsKey, attempts + 1, TimeSpan.FromMinutes(ResetTokenLifetimeMinutes));
            throw new ApiException(ErrorCodes.CodeInvalid, "Invalid or expired reset code.");
        }

        // Check if token was never issued or already consumed
        if (string.IsNullOrEmpty(user.PasswordResetToken))
        {
            _cache.Set(attemptsKey, attempts + 1, TimeSpan.FromMinutes(ResetTokenLifetimeMinutes));
            throw new ApiException(ErrorCodes.CodeInvalid, "Invalid or expired reset code.");
        }

        // Check expiration explicitly
        if (user.PasswordResetTokenExpiresAtUtc is null || user.PasswordResetTokenExpiresAtUtc < DateTime.UtcNow)
        {
            _cache.Set(attemptsKey, attempts + 1, TimeSpan.FromMinutes(ResetTokenLifetimeMinutes));
            throw new ApiException(ErrorCodes.CodeExpired, "This code has expired. Please request a new one.");
        }

        // Check token match
        if (user.PasswordResetToken != request.Token)
        {
            _cache.Set(attemptsKey, attempts + 1, TimeSpan.FromMinutes(ResetTokenLifetimeMinutes));
            throw new ApiException(ErrorCodes.CodeInvalid, "That code doesn't match. Please check and try again.");
        }

        // Success — reset the password and clean up
        CreatePasswordHash(request.NewPassword, out string hash, out string salt);
        user.PasswordHash = hash;
        user.PasswordSalt = salt;
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpiresAtUtc = null;

        await _db.SaveChangesAsync();

        // Clear attempt counter
        _cache.Remove(attemptsKey);
    }

    private AuthResponse GenerateToken(User user)
    {
        var expires = DateTime.UtcNow.AddMinutes(_jwt.ExpirationMinutes);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Email, user.Email)
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.SecretKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _jwt.Issuer,
            audience: _jwt.Audience,
            claims: claims,
            expires: expires,
            signingCredentials: creds);

        return new AuthResponse
        {
            UserId = user.UserId,
            Username = user.Username,
            Token = new JwtSecurityTokenHandler().WriteToken(token),
            ExpiresAtUtc = expires
        };
    }

    private static void CreatePasswordHash(string password, out string hash, out string salt)
    {
        var saltBytes = RandomNumberGenerator.GetBytes(32);
        salt = Convert.ToBase64String(saltBytes);

        using var hmac = new HMACSHA512(saltBytes);
        var hashBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(password));
        hash = Convert.ToBase64String(hashBytes);
    }

    private static bool VerifyPasswordHash(string password, string storedHash, string? storedSalt)
    {
        if (string.IsNullOrEmpty(storedSalt)) return false;

        var saltBytes = Convert.FromBase64String(storedSalt);
        using var hmac = new HMACSHA512(saltBytes);
        var computedHash = hmac.ComputeHash(Encoding.UTF8.GetBytes(password));

        return Convert.ToBase64String(computedHash) == storedHash;
    }

    private static string GenerateResetToken()
    {
        return RandomNumberGenerator.GetInt32(100_000, 1_000_000).ToString();
    }
}
