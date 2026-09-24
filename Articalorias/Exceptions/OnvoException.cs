namespace Articalorias.Exceptions;

/// <summary>
/// A call to the ONVO API failed. <see cref="StatusCode"/> is the HTTP status
/// ONVO answered with, or 0 when ONVO could not be reached at all (DNS,
/// timeout, connection reset). The message is for logs, never for users.
/// </summary>
public class OnvoException : Exception
{
    public int StatusCode { get; }

    public OnvoException(int statusCode, string message, Exception? inner = null)
        : base(message, inner)
    {
        StatusCode = statusCode;
    }

    public bool IsNotFound => StatusCode == StatusCodes.Status404NotFound;

    /// <summary>ONVO rejected the request itself (bad id, wrong account), as opposed to being down.</summary>
    public bool IsClientError => StatusCode is >= 400 and < 500;
}
