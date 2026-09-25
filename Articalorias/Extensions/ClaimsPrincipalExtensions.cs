using System.Security.Claims;

namespace Articalorias.Extensions;

/// <summary>
/// The one place the authenticated user id is read from the token. Every
/// controller and filter goes through here so ownership checks cannot drift
/// on how the claim is parsed.
/// </summary>
public static class ClaimsPrincipalExtensions
{
    public static long GetUserId(this ClaimsPrincipal user)
    {
        var claim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (claim is null || !long.TryParse(claim, out var userId))
            throw new UnauthorizedAccessException("User ID claim missing.");
        return userId;
    }
}
