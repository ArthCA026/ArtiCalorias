using System.Net;
using System.Text.Json;
using Articalorias.Exceptions;

namespace Articalorias.Middleware;

public class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _logger;

    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception");
            await HandleExceptionAsync(context, ex);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";

        if (exception is ApiException apiEx)
        {
            context.Response.StatusCode = apiEx.StatusCode;
            var response = new { StatusCode = apiEx.StatusCode, Message = apiEx.Message, ErrorCode = apiEx.ErrorCode };
            await context.Response.WriteAsync(JsonSerializer.Serialize(response));
            return;
        }

        var (statusCode, message) = exception switch
        {
            UnauthorizedAccessException => ((int)HttpStatusCode.Unauthorized, "Unauthorized."),
            // Our own services throw InvalidOperationException with copy meant
            // for the user. The same type thrown by EF Core / the framework
            // carries internal detail (entity names, query shape) and is
            // never echoed: callers get a neutral 400 and the log has the rest.
            InvalidOperationException when IsThrownByApp(exception)
                => ((int)HttpStatusCode.BadRequest, exception.Message),
            InvalidOperationException => ((int)HttpStatusCode.BadRequest, "The request could not be processed."),
            _ => ((int)HttpStatusCode.InternalServerError, "An unexpected error occurred.")
        };

        context.Response.StatusCode = statusCode;

        var fallbackResponse = new { StatusCode = statusCode, Message = message };
        await context.Response.WriteAsync(JsonSerializer.Serialize(fallbackResponse));
    }

    /// <summary>
    /// True when the throwing method lives in this assembly. Async state
    /// machines are nested in their declaring type, so the namespace check
    /// still holds for awaited code.
    /// </summary>
    private static bool IsThrownByApp(Exception exception)
    {
        var ns = exception.TargetSite?.DeclaringType?.Namespace;
        return ns is not null && ns.StartsWith("Articalorias", StringComparison.Ordinal);
    }
}
