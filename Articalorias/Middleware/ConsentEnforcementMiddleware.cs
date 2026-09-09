using System.Net;
using System.Security.Claims;
using System.Text.Json;
using Articalorias.Exceptions;
using Articalorias.Interfaces;

namespace Articalorias.Middleware;

/// <summary>
/// Safety net behind the frontend consent gate (Ley 8968): authenticated
/// WRITE requests are rejected with 403 CONSENT_REQUIRED until the user holds
/// a health-data consent at the current policy version. Reads stay open (the
/// Art. 7 right of access), and the allowlist keeps consent recording, auth
/// flows, and account/history deletion working - a revoked user must always
/// be able to consent again or erase their data.
/// </summary>
public class ConsentEnforcementMiddleware
{
    private readonly RequestDelegate _next;

    public ConsentEnforcementMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IConsentService consentService)
    {
        if (RequiresConsentCheck(context))
        {
            var claim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (claim is not null && long.TryParse(claim, out var userId) &&
                !await consentService.HasCurrentHealthGrantAsync(userId, context.RequestAborted))
            {
                context.Response.StatusCode = (int)HttpStatusCode.Forbidden;
                context.Response.ContentType = "application/json";

                // Same shape (and casing) as ErrorHandlingMiddleware responses.
                var response = new
                {
                    StatusCode = (int)HttpStatusCode.Forbidden,
                    Message = "Consent to health data processing is required before the app can save new data.",
                    ErrorCode = ErrorCodes.ConsentRequired
                };
                await context.Response.WriteAsync(JsonSerializer.Serialize(response));
                return;
            }
        }

        await _next(context);
    }

    private static bool RequiresConsentCheck(HttpContext context)
    {
        if (context.User.Identity?.IsAuthenticated != true)
            return false;

        var method = context.Request.Method;
        var isWrite = HttpMethods.IsPost(method) || HttpMethods.IsPut(method) ||
                      HttpMethods.IsPatch(method) || HttpMethods.IsDelete(method);
        if (!isWrite)
            return false;

        var path = context.Request.Path;
        if (!path.StartsWithSegments("/api"))
            return false;

        // Always allowed: auth flows, consenting itself, health checks.
        if (path.StartsWithSegments("/api/auth") ||
            path.StartsWithSegments("/api/consent") ||
            path.StartsWithSegments("/api/health"))
            return false;

        // Always allowed: the Art. 7 erasure endpoints.
        if (HttpMethods.IsDelete(method) &&
            (path.StartsWithSegments("/api/user/account") || path.StartsWithSegments("/api/user/history")))
            return false;

        return true;
    }
}
