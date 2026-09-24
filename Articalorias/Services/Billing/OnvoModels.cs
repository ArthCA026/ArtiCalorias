using System.Globalization;
using System.Text.Json.Serialization;

namespace Articalorias.Services.Billing;

// Wire shapes of the ONVO REST API (https://docs.onvopay.com/openapi.yaml),
// reduced to the fields billing reads. Dates stay strings on the wire model:
// ONVO sends ISO-8601 UTC, but also nulls and empty strings, and one odd value
// must never fail the deserialization of an otherwise good payment.

public static class OnvoSubscriptionStatuses
{
    public const string Incomplete = "incomplete";
    public const string IncompleteExpired = "incomplete_expired";
    public const string Trialing = "trialing";
    public const string Active = "active";
    public const string PastDue = "past_due";
    public const string Unpaid = "unpaid";
    public const string Canceled = "canceled";

    /// <summary>Nothing further can happen to the subscription at ONVO.</summary>
    public static bool IsTerminal(string status) => status is Canceled or IncompleteExpired;
}

public sealed class OnvoProduct
{
    [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
}

public sealed class OnvoPrice
{
    [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
}

public sealed class OnvoCustomer
{
    [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
}

public sealed class OnvoInvoice
{
    [JsonPropertyName("id")] public string? Id { get; set; }

    /// <summary>draft | open | paid | void | uncollectible.</summary>
    [JsonPropertyName("status")] public string? Status { get; set; }

    [JsonPropertyName("currency")] public string? Currency { get; set; }
    [JsonPropertyName("total")] public decimal? Total { get; set; }
    [JsonPropertyName("paymentIntentId")] public string? PaymentIntentId { get; set; }
    [JsonPropertyName("periodStart")] public string? PeriodStart { get; set; }
    [JsonPropertyName("periodEnd")] public string? PeriodEnd { get; set; }

    [JsonIgnore] public bool IsPaid => string.Equals(Status, "paid", StringComparison.OrdinalIgnoreCase);
    [JsonIgnore] public DateTime? PeriodStartUtc => OnvoDates.Parse(PeriodStart);
    [JsonIgnore] public DateTime? PeriodEndUtc => OnvoDates.Parse(PeriodEnd);
}

public sealed class OnvoSubscription
{
    [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
    [JsonPropertyName("mode")] public string? Mode { get; set; }
    [JsonPropertyName("status")] public string? Status { get; set; }
    [JsonPropertyName("customerId")] public string? CustomerId { get; set; }
    [JsonPropertyName("cancelAtPeriodEnd")] public bool? CancelAtPeriodEnd { get; set; }
    [JsonPropertyName("canceledAt")] public string? CanceledAt { get; set; }
    [JsonPropertyName("currentPeriodStart")] public string? CurrentPeriodStart { get; set; }
    [JsonPropertyName("currentPeriodEnd")] public string? CurrentPeriodEnd { get; set; }
    [JsonPropertyName("latestInvoice")] public OnvoInvoice? LatestInvoice { get; set; }

    [JsonIgnore] public DateTime? CanceledAtUtc => OnvoDates.Parse(CanceledAt);
    [JsonIgnore] public DateTime? CurrentPeriodStartUtc => OnvoDates.Parse(CurrentPeriodStart);
    [JsonIgnore] public DateTime? CurrentPeriodEndUtc => OnvoDates.Parse(CurrentPeriodEnd);
}

public sealed class OnvoPaymentIntent
{
    [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;

    /// <summary>requires_payment_method | requires_action | requires_capture | processing | succeeded | failed | refunded | partially_refunded | canceled.</summary>
    [JsonPropertyName("status")] public string? Status { get; set; }

    [JsonPropertyName("amount")] public decimal? Amount { get; set; }
    [JsonPropertyName("currency")] public string? Currency { get; set; }
    [JsonPropertyName("customerId")] public string? CustomerId { get; set; }
}

internal static class OnvoDates
{
    public static DateTime? Parse(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        return DateTimeOffset.TryParse(
            value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed)
            ? parsed.UtcDateTime
            : null;
    }
}
