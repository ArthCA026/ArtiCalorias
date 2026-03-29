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
            context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
            var response = new { StatusCode = (int)HttpStatusCode.BadRequest, Message = apiEx.Message, ErrorCode = apiEx.ErrorCode };
            await context.Response.WriteAsync(JsonSerializer.Serialize(response));
            return;
        }

        var (statusCode, message) = exception switch
        {
            UnauthorizedAccessException => ((int)HttpStatusCode.Unauthorized, exception.Message),
            InvalidOperationException => ((int)HttpStatusCode.BadRequest, exception.Message),
            _ => ((int)HttpStatusCode.InternalServerError, "An unexpected error occurred.")
        };

        context.Response.StatusCode = statusCode;

        var fallbackResponse = new { StatusCode = statusCode, Message = message };
        await context.Response.WriteAsync(JsonSerializer.Serialize(fallbackResponse));
    }
}
