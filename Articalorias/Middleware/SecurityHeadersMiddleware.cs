namespace Articalorias.Middleware;

/// <summary>
/// Response headers for the JSON API. Registered with OnStarting so they also
/// land on bodies written by the error handler. The CSP and no-store are
/// scoped to /api so the Development-only API reference page keeps its own
/// scripts and styles.
/// </summary>
public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(static state =>
        {
            var ctx = (HttpContext)state;
            var headers = ctx.Response.Headers;

            headers["X-Content-Type-Options"] = "nosniff";
            headers["X-Frame-Options"] = "DENY";
            headers["Referrer-Policy"] = "no-referrer";
            headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";

            if (ctx.Request.Path.StartsWithSegments("/api"))
            {
                // A pure data API renders nothing; a CSP that allows nothing
                // neutralises any reflected content a browser might try to run.
                headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
                headers["Cache-Control"] = "no-store";
            }

            return Task.CompletedTask;
        }, context);

        return _next(context);
    }
}
