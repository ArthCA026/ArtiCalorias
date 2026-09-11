namespace Articalorias.Exceptions;

/// <summary>
/// Represents a business-rule violation that carries a machine-readable error code
/// the frontend can map to a user-friendly message.
/// </summary>
public class ApiException : Exception
{
    public string ErrorCode { get; }

    /// <summary>
    /// HTTP status the middleware answers with. Defaults to 400 (business-rule
    /// violation); pass 503 for "our side is temporarily unable", e.g. a
    /// downstream provider rejecting us.
    /// </summary>
    public int StatusCode { get; }

    public ApiException(string errorCode, string message, int statusCode = StatusCodes.Status400BadRequest)
        : base(message)
    {
        ErrorCode = errorCode;
        StatusCode = statusCode;
    }
}

public static class ErrorCodes
{
    public const string CodeExpired = "CODE_EXPIRED";
    public const string CodeInvalid = "CODE_INVALID";
    public const string TooManyAttempts = "TOO_MANY_ATTEMPTS";
    public const string ResendCooldown = "RESEND_COOLDOWN";
    public const string EmailDeliveryFailed = "EMAIL_DELIVERY_FAILED";
    public const string InvalidInput = "INVALID_INPUT";
    public const string ActivityDurationExceeded = "ACTIVITY_DURATION_EXCEEDED";
    public const string FastingDayHasFood = "FASTING_DAY_HAS_FOOD";
    public const string ConsentRequired = "CONSENT_REQUIRED";
    public const string ConsentVersionStale = "CONSENT_VERSION_STALE";
    public const string AiRateLimited = "AI_RATE_LIMITED";
}
