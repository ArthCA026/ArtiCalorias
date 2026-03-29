namespace Articalorias.Exceptions;

/// <summary>
/// Represents a business-rule violation that carries a machine-readable error code
/// the frontend can map to a user-friendly message.
/// </summary>
public class ApiException : Exception
{
    public string ErrorCode { get; }

    public ApiException(string errorCode, string message) : base(message)
    {
        ErrorCode = errorCode;
    }
}

public static class ErrorCodes
{
    public const string CodeExpired = "CODE_EXPIRED";
    public const string CodeInvalid = "CODE_INVALID";
    public const string TooManyAttempts = "TOO_MANY_ATTEMPTS";
    public const string ResendCooldown = "RESEND_COOLDOWN";
}
