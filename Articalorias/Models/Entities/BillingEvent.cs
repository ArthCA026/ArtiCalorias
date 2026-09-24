namespace Articalorias.Models.Entities;

/// <summary>
/// Append-only billing audit trail: what the user agreed to at checkout, when
/// a payment was verified, when they cancelled. It is the evidence for a
/// dispute ("I never agreed to renew", "I cancelled before that charge") and
/// the first place to look when support asks what happened to an account.
/// Cascade-deletes with the account.
/// </summary>
public class BillingEvent
{
    public long BillingEventId { get; set; }
    public long UserId { get; set; }

    /// <summary>Plain column, not a foreign key: SQL Server rejects a second cascade path from User.</summary>
    public long? UserSubscriptionId { get; set; }

    /// <summary>See BillingEventTypes.</summary>
    public string EventType { get; set; } = string.Empty;

    /// <summary>
    /// Makes an event write-once (unique with EventType when set): a payment
    /// intent id for activations and renewals, so a webhook redelivery or a
    /// concurrent client sync cannot log, or notify about, the same charge twice.
    /// </summary>
    public string? DedupeKey { get; set; }

    /// <summary>Short human-readable context. Never card data: the API never sees any.</summary>
    public string? Detail { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    // Navigation
    public User User { get; set; } = null!;
}
