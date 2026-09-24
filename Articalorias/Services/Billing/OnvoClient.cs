using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Articalorias.Configuration;
using Articalorias.Exceptions;
using Articalorias.Interfaces;
using Microsoft.Extensions.Options;

namespace Articalorias.Services.Billing;

/// <summary>
/// Minimal typed client for the ONVO Pay REST API. Server-only: every request
/// carries the SECRET key, which must never appear in a log line or a response.
/// </summary>
public class OnvoClient : IOnvoClient
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private readonly HttpClient _http;
    private readonly OnvoSettings _settings;
    private readonly ILogger<OnvoClient> _logger;

    public OnvoClient(HttpClient http, IOptions<OnvoSettings> settings, ILogger<OnvoClient> logger)
    {
        _http = http;
        _settings = settings.Value;
        _logger = logger;
    }

    public Task<OnvoProduct> CreateProductAsync(string name, string description, CancellationToken ct = default) =>
        SendAsync<OnvoProduct>(HttpMethod.Post, "v1/products",
            new { name, description, isActive = true }, ct);

    public Task<OnvoPrice> CreateRecurringPriceAsync(
        string productId, int unitAmountCents, string currency, string interval, string nickname,
        CancellationToken ct = default) =>
        SendAsync<OnvoPrice>(HttpMethod.Post, "v1/prices",
            new
            {
                productId,
                unitAmount = unitAmountCents,
                currency,
                type = "recurring",
                nickname,
                recurring = new { interval, intervalCount = 1 }
            }, ct);

    public Task<OnvoCustomer> CreateCustomerAsync(string name, string email, CancellationToken ct = default) =>
        SendAsync<OnvoCustomer>(HttpMethod.Post, "v1/customers", new { name, email }, ct);

    public Task<OnvoSubscription> CreateIncompleteSubscriptionAsync(
        string customerId, string priceId, string description, IReadOnlyDictionary<string, string> metadata,
        CancellationToken ct = default) =>
        SendAsync<OnvoSubscription>(HttpMethod.Post, "v1/subscriptions",
            new
            {
                customerId,
                paymentBehavior = "allow_incomplete",
                description,
                items = new[] { new { priceId, quantity = 1 } },
                metadata
            }, ct);

    public Task<OnvoSubscription> GetSubscriptionAsync(string subscriptionId, CancellationToken ct = default) =>
        SendAsync<OnvoSubscription>(HttpMethod.Get, $"v1/subscriptions/{Uri.EscapeDataString(subscriptionId)}", null, ct);

    public Task<OnvoSubscription> SetCancelAtPeriodEndAsync(
        string subscriptionId, bool cancelAtPeriodEnd, CancellationToken ct = default) =>
        // ONVO updates a subscription with POST, not PATCH.
        SendAsync<OnvoSubscription>(HttpMethod.Post, $"v1/subscriptions/{Uri.EscapeDataString(subscriptionId)}",
            new { cancelAtPeriodEnd }, ct);

    public Task<OnvoSubscription> CancelSubscriptionAsync(string subscriptionId, CancellationToken ct = default) =>
        SendAsync<OnvoSubscription>(HttpMethod.Delete, $"v1/subscriptions/{Uri.EscapeDataString(subscriptionId)}", null, ct);

    public Task<OnvoPaymentIntent> GetPaymentIntentAsync(string paymentIntentId, CancellationToken ct = default) =>
        SendAsync<OnvoPaymentIntent>(HttpMethod.Get, $"v1/payment-intents/{Uri.EscapeDataString(paymentIntentId)}", null, ct);

    private async Task<T> SendAsync<T>(HttpMethod method, string path, object? body, CancellationToken ct)
    {
        if (!_settings.HasSecretKey)
            throw new OnvoException(0, "The ONVO secret key is not configured.");

        using var request = new HttpRequestMessage(method, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _settings.SecretKey);
        if (body is not null)
            request.Content = JsonContent.Create(body, options: JsonOptions);

        HttpResponseMessage response;
        try
        {
            response = await _http.SendAsync(request, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            // TaskCanceledException without a cancelled token is HttpClient's timeout.
            _logger.LogWarning(ex, "ONVO {Method} {Path} could not be reached.", method, path);
            throw new OnvoException(0, $"ONVO could not be reached ({method} {path}).", ex);
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
            {
                var message = await ReadErrorMessageAsync(response, ct);
                _logger.LogWarning("ONVO {Method} {Path} answered {Status}: {Message}",
                    method, path, (int)response.StatusCode, message);
                throw new OnvoException((int)response.StatusCode, message);
            }

            try
            {
                return await response.Content.ReadFromJsonAsync<T>(JsonOptions, ct)
                    ?? throw new OnvoException((int)response.StatusCode, $"ONVO answered {method} {path} with an empty body.");
            }
            catch (JsonException ex)
            {
                throw new OnvoException((int)response.StatusCode, $"ONVO answered {method} {path} with an unreadable body.", ex);
            }
        }
    }

    /// <summary>ONVO errors are { statusCode, message, error } where message is a string or a string array.</summary>
    private static async Task<string> ReadErrorMessageAsync(HttpResponseMessage response, CancellationToken ct)
    {
        var fallback = $"ONVO request failed ({(int)response.StatusCode}).";
        try
        {
            var raw = await response.Content.ReadAsStringAsync(ct);
            if (string.IsNullOrWhiteSpace(raw))
                return fallback;

            using var doc = JsonDocument.Parse(raw);
            if (doc.RootElement.ValueKind != JsonValueKind.Object ||
                !doc.RootElement.TryGetProperty("message", out var message))
                return fallback;

            var text = message.ValueKind switch
            {
                JsonValueKind.String => message.GetString(),
                JsonValueKind.Array => string.Join("; ", message.EnumerateArray()
                    .Where(m => m.ValueKind == JsonValueKind.String)
                    .Select(m => m.GetString())),
                _ => null
            };
            return string.IsNullOrWhiteSpace(text) ? fallback : text;
        }
        catch (Exception ex) when (ex is JsonException or HttpRequestException or IOException)
        {
            return fallback;
        }
    }
}
