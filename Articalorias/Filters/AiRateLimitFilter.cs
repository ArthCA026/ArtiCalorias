using System.Security.Claims;
using System.Text.Json;
using Articalorias.Configuration;
using Articalorias.Exceptions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Caching.Memory;
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
    private readonly IMemoryCache _cache;
    private readonly AiRateLimitSettings _settings;
    private readonly ILogger<AiRateLimitFilter> _logger;

    public AiRateLimitFilter(
        IMemoryCache cache,
        IOptions<AiRateLimitSettings> settings,
        ILogger<AiRateLimitFilter> logger)
    {
        _cache = cache;
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

        if (!TryConsume($"ai-rl:m:{userId}", _settings.PerMinute, TimeSpan.FromMinutes(1), out var retryAfter) ||
            !TryConsume($"ai-rl:d:{userId}", _settings.PerDay, TimeSpan.FromHours(24), out retryAfter))
        {
            _logger.LogWarning("AI rate limit hit for user {UserId} (retry in {RetryAfter})", userId, retryAfter);
            Reject(context, retryAfter);
            return;
        }

        await next();
    }

    private sealed class Counter
    {
        public int Count;
        public DateTime WindowEndsUtc;
    }

    private bool TryConsume(string key, int limit, TimeSpan window, out TimeSpan retryAfter)
    {
        var counter = _cache.GetOrCreate(key, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = window;
            return new Counter { WindowEndsUtc = DateTime.UtcNow.Add(window) };
        })!;

        // Failed calls count too: abuse protection must not exempt errors.
        var count = Interlocked.Increment(ref counter.Count);
        if (count <= limit)
        {
            retryAfter = TimeSpan.Zero;
            return true;
        }

        retryAfter = counter.WindowEndsUtc - DateTime.UtcNow;
        if (retryAfter < TimeSpan.Zero) retryAfter = TimeSpan.Zero;
        return false;
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
