using System.Security.Claims;
using System.Text.Json;
using Articalorias.Exceptions;
using Articalorias.Interfaces;

namespace Articalorias.Middleware;

/// <summary>
/// The paywall, server side. ArtiCalorias is subscription-only: an
/// authenticated request to anything that is not on the open list below is
/// answered 402 SUBSCRIPTION_REQUIRED unless the account has a paid period, a
/// grace window, or a SubscriptionWhitelist entry. The client gate is the
/// experience; this is the rule, and it holds for a hand-written API client
/// too.
///
/// DENY BY DEFAULT: a controller added tomorrow is behind the paywall without
/// anyone remembering to put it there. What stays open is only what an account
/// without a subscription legitimately needs:
///  - signing in, consenting, health checks;
///  - billing itself, and the ONVO webhook;
///  - api/user: data export and account or history deletion. The Ley 8968
///    rights of access and erasure do not depend on being a paying customer;
///  - the onboarding surface (profile, macro catalog and preferences,
///    reminders), because the plan is built BEFORE the paywall is shown.
///    None of it is the product: no logging, no AI, no dashboard, no history.
/// </summary>
public class SubscriptionEnforcementMiddleware
{
    private static readonly string[] OpenPrefixes =
    [
        "/api/auth",
        "/api/consent",
        "/api/health",
        "/api/billing",
        "/api/webhooks",
        "/api/user",
        "/api/userprofile",
        "/api/macros",
        "/api/macropreferences",
        "/api/pushnotification"
    ];

    private readonly RequestDelegate _next;

    public SubscriptionEnforcementMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IBillingService billing)
    {
        if (RequiresSubscription(context))
        {
            var claim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (claim is not null && long.TryParse(claim, out var userId) &&
                !await billing.HasAccessAsync(userId, context.RequestAborted))
            {
                context.Response.StatusCode = StatusCodes.Status402PaymentRequired;
                context.Response.ContentType = "application/json";

                // Same shape (and casing) as ErrorHandlingMiddleware responses.
                var response = new
                {
                    StatusCode = StatusCodes.Status402PaymentRequired,
                    Message = "An active subscription is required to use ArtiCalorias.",
                    ErrorCode = ErrorCodes.SubscriptionRequired
                };
                await context.Response.WriteAsync(JsonSerializer.Serialize(response));
                return;
            }
        }

        await _next(context);
    }

    private static bool RequiresSubscription(HttpContext context)
    {
        // Anonymous requests are [Authorize]'s business, preflights are CORS's.
        if (context.User.Identity?.IsAuthenticated != true || HttpMethods.IsOptions(context.Request.Method))
            return false;

        var path = context.Request.Path;
        if (!path.StartsWithSegments("/api"))
            return false;

        foreach (var prefix in OpenPrefixes)
        {
            if (path.StartsWithSegments(prefix, StringComparison.OrdinalIgnoreCase))
                return false;
        }

        return true;
    }
}
