using System.Text.Json;
using System.Threading.RateLimiting;
using Articalorias.Exceptions;
using Microsoft.AspNetCore.RateLimiting;

namespace Articalorias.Configuration;

/// <summary>
/// Per-client-IP request limits (built-in Microsoft.AspNetCore.RateLimiting).
/// The client IP is only real when the App Service front end's
/// X-Forwarded-For header is honoured: set ASPNETCORE_FORWARDEDHEADERS_ENABLED=true
/// in the App Service configuration (local runs have no proxy and need nothing).
/// Per-account throttles (login failures, reset codes) live in AuthService
/// because their key is inside the JSON body, which the limiter never sees.
/// </summary>
public static class RateLimitingExtensions
{
    /// <summary>Every request: a ceiling only a scraper or a runaway client reaches.</summary>
    public const int GlobalPerMinute = 300;

    /// <summary>All /api/auth endpoints together, per IP.</summary>
    public const string AuthPolicy = "auth-ip";
    public const int AuthPerMinute = 20;

    /// <summary>
    /// Account creation and password reset, per IP. Loose enough for a
    /// household behind one address (a sign-up plus a fumbled reset), tight
    /// enough that enumeration or code guessing gets nowhere; the per-email
    /// counters in AuthService do the fine-grained work.
    /// </summary>
    public const string AuthStrictPolicy = "auth-strict-ip";
    public const int AuthStrictPer15Minutes = 20;

    public static IServiceCollection AddApiRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                RateLimitPartition.GetSlidingWindowLimiter(ClientKey(context), _ => new SlidingWindowRateLimiterOptions
                {
                    PermitLimit = GlobalPerMinute,
                    Window = TimeSpan.FromMinutes(1),
                    SegmentsPerWindow = 6,
                    QueueLimit = 0
                }));

            options.AddPolicy(AuthPolicy, context =>
                RateLimitPartition.GetFixedWindowLimiter(ClientKey(context), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = AuthPerMinute,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0
                }));

            options.AddPolicy(AuthStrictPolicy, context =>
                RateLimitPartition.GetFixedWindowLimiter(ClientKey(context), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = AuthStrictPer15Minutes,
                    Window = TimeSpan.FromMinutes(15),
                    QueueLimit = 0
                }));

            options.OnRejected = async (context, ct) =>
            {
                var http = context.HttpContext;
                var response = http.Response;
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                    response.Headers.RetryAfter = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();

                http.RequestServices.GetRequiredService<ILoggerFactory>()
                    .CreateLogger("Articalorias.RateLimiting")
                    .LogWarning("Rate limit hit: {Method} {Path} from {Ip}",
                        http.Request.Method, http.Request.Path, ClientKey(http));

                // Same body shape as ErrorHandlingMiddleware / AiRateLimitFilter
                // so the frontend's extractApiError reads it unchanged.
                response.ContentType = "application/json";
                await response.WriteAsync(JsonSerializer.Serialize(new
                {
                    StatusCode = StatusCodes.Status429TooManyRequests,
                    Message = "Too many requests. Please try again shortly.",
                    ErrorCode = ErrorCodes.RateLimited
                }), ct);
            };
        });

        return services;
    }

    public static string ClientKey(HttpContext context)
        => context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
}
