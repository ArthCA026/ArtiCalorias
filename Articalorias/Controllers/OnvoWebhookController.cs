using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Articalorias.Configuration;
using Articalorias.Exceptions;
using Articalorias.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Articalorias.Controllers;

/// <summary>
/// ONVO webhook receiver (https://docs.onvopay.com/webhooks). Register
/// https://{api-host}/api/webhooks/onvo in the ONVO dashboard.
///
/// ONVO authenticates a delivery with a STATIC shared secret in the
/// X-Webhook-Secret header: there is no signature over the body. So the body
/// is treated as a hint and nothing more. The only things read from it are
/// which subscription or customer to look at; the state itself is then
/// fetched from the ONVO API with the secret key. A forged or replayed event
/// can therefore make the server re-read a subscription, and nothing else.
/// That also makes redeliveries and out-of-order events harmless.
///
/// Answers: 2xx once handled (or when the event is not about us), 401 on a
/// bad secret, 503 while unconfigured, 5xx when ONVO could not be re-read so
/// the delivery shows as failed in the dashboard. Correctness never depends on
/// a retry: the app re-reads a due subscription when its owner opens it.
/// </summary>
[ApiController]
[Route("api/webhooks/onvo")]
[AllowAnonymous]
public class OnvoWebhookController : ControllerBase
{
    private const string SecretHeader = "X-Webhook-Secret";
    private const int MaxBodyBytes = 256 * 1024;

    private readonly IBillingService _billing;
    private readonly OnvoSettings _settings;
    private readonly ILogger<OnvoWebhookController> _logger;

    public OnvoWebhookController(
        IBillingService billing, IOptions<OnvoSettings> settings, ILogger<OnvoWebhookController> logger)
    {
        _billing = billing;
        _settings = settings.Value;
        _logger = logger;
    }

    [HttpPost]
    [RequestSizeLimit(MaxBodyBytes)]
    public async Task<IActionResult> Receive(CancellationToken ct)
    {
        if (!_settings.HasWebhookSecret)
        {
            // Never process an event that cannot be verified.
            _logger.LogError("ONVO webhook received but Onvo:WebhookSecret is not configured.");
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = "webhook not configured" });
        }

        var provided = Request.Headers[SecretHeader].ToString();
        if (!SecretsMatch(provided, _settings.WebhookSecret))
        {
            _logger.LogWarning("ONVO webhook rejected: missing or wrong {Header} from {RemoteIp}.",
                SecretHeader, HttpContext.Connection.RemoteIpAddress);
            return Unauthorized(new { error = "invalid webhook secret" });
        }

        string? eventType;
        string? subscriptionId;
        string? customerId;
        try
        {
            using var doc = await JsonDocument.ParseAsync(Request.Body, cancellationToken: ct);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
                return BadRequest(new { error = "invalid payload" });

            eventType = ReadString(root, "type");
            var data = root.TryGetProperty("data", out var d) && d.ValueKind == JsonValueKind.Object ? d : default;

            subscriptionId = ReadString(data, "subscriptionId");
            customerId = ReadString(data, "customerId");
            if (customerId is null && data.ValueKind == JsonValueKind.Object &&
                data.TryGetProperty("customer", out var customer))
                customerId = ReadString(customer, "id");
        }
        catch (JsonException)
        {
            return BadRequest(new { error = "invalid payload" });
        }

        if (string.IsNullOrWhiteSpace(eventType))
            return BadRequest(new { error = "invalid payload" });

        // Subscription renewals and the payment intents behind them both mean
        // "re-read this subscription". Everything else is acknowledged unread.
        var relevant = eventType.StartsWith("subscription.", StringComparison.Ordinal) ||
                       eventType.StartsWith("payment-intent.", StringComparison.Ordinal);
        if (!relevant || (subscriptionId is null && customerId is null))
            return Ok(new { received = true, ignored = true });

        try
        {
            var handled = await _billing.HandleProviderEventAsync(eventType, subscriptionId, customerId, ct);
            _logger.LogInformation("ONVO webhook {EventType} for subscription {SubscriptionId}: {Outcome}.",
                eventType, subscriptionId ?? "(by customer)", handled ? "synced" : "not ours");
            return Ok(new { received = true, ignored = !handled });
        }
        catch (OnvoException ex)
        {
            _logger.LogError(ex, "ONVO webhook {EventType}: could not re-read subscription {SubscriptionId} from ONVO.",
                eventType, subscriptionId);
            return StatusCode(StatusCodes.Status502BadGateway, new { error = "could not verify with ONVO" });
        }
    }

    /// <summary>Constant-time comparison: the secret must not be recoverable byte by byte from response timing.</summary>
    private static bool SecretsMatch(string provided, string expected)
    {
        if (string.IsNullOrEmpty(provided))
            return false;

        var a = Encoding.UTF8.GetBytes(provided);
        var b = Encoding.UTF8.GetBytes(expected);
        return CryptographicOperations.FixedTimeEquals(a, b);
    }

    private static string? ReadString(JsonElement element, string property)
    {
        if (element.ValueKind != JsonValueKind.Object ||
            !element.TryGetProperty(property, out var value) ||
            value.ValueKind != JsonValueKind.String)
            return null;

        var text = value.GetString();
        // Ids are short opaque tokens; anything else is not an id.
        return string.IsNullOrWhiteSpace(text) || text.Length > 64 ? null : text;
    }
}
