using System.Security.Claims;
using System.Text.Json;
using Articalorias.Configuration;
using Articalorias.Exceptions;
using Articalorias.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;

namespace Articalorias.Filters;

/// <summary>
/// Marks an endpoint as a paid AI call and enforces per-user quotas on it.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public class AiRateLimitAttribute : TypeFilterAttribute
{
    public AiRateLimitAttribute() : base(typeof(AiRateLimitFilter)) { }
}

/// <summary>
/// Per-user minute + rolling-24h quotas for the AI endpoints. Windows anchor
/// at each user's first request, so behavior is identical in every time zone
/// (a calendar-day window would reset at 6 pm in Costa Rica). Counters live in
/// memory: a restart resets them, which only ever errs in the user's favor.
/// </summary>
public class AiRateLimitFilter : IAsyncActionFilter
{
    private readonly MemoryRateCounter _counter;
    private readonly AiRateLimitSettings _settings;
    private readonly ILogger<AiRateLimitFilter> _logger;

    public AiRateLimitFilter(
        MemoryRateCounter counter,
        IOptions<AiRateLimitSettings> settings,
        ILogger<AiRateLimitFilter> logger)
    {
        _counter = counter;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var userId = context.HttpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userId is null)
        {
            // [Authorize] makes this unreachable; fail closed anyway.
            context.Result = new UnauthorizedResult();
            return;
        }

        // Failed calls count too: abuse protection must not exempt errors.
        if (!_counter.TryConsume($"ai-rl:m:{userId}", _settings.PerMinute, TimeSpan.FromMinutes(1), out var retryAfter) ||
            !_counter.TryConsume($"ai-rl:d:{userId}", _settings.PerDay, TimeSpan.FromHours(24), out retryAfter))
        {
            _logger.LogWarning("AI rate limit hit for user {UserId} (retry in {RetryAfter})", userId, retryAfter);
            Reject(context, retryAfter);
            return;
        }

        await next();
    }

    private static void Reject(ActionExecutingContext context, TimeSpan retryAfter)
    {
        var retryAfterSeconds = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds));
        context.HttpContext.Response.Headers.RetryAfter = retryAfterSeconds.ToString();

        // Serialized manually to match the ErrorHandlingMiddleware body shape
        // (PascalCase keys) that the frontend's extractApiError already reads.
        context.Result = new ContentResult
        {
            StatusCode = StatusCodes.Status429TooManyRequests,
            ContentType = "application/json",
            Content = JsonSerializer.Serialize(new
            {
                StatusCode = StatusCodes.Status429TooManyRequests,
                Message = "You've reached the AI parsing limit. Please wait a bit and try again.",
                ErrorCode = ErrorCodes.AiRateLimited
            })
        };
    }
}
