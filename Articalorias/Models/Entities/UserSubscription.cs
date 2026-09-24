namespace Articalorias.Models.Entities;

/// <summary>
/// Local mirror of one ONVO recurring charge ("subscription"). ONVO is the
/// source of truth; this row is refreshed from the ONVO API (never from a
/// webhook body) and exists so the access check is a local query.
///
/// A user can own several rows over time (a lapsed plan, then a new one). What
/// grants access is <see cref="PaidThroughUtc"/>: the end of the last period
/// whose payment was verified. A row that was never paid grants nothing.
/// Cascade-deletes with the account; ONVO keeps the transaction records.
/// </summary>
public class UserSubscription
{
    public long UserSubscriptionId { get; set; }
    public long UserId { get; set; }

    /// <summary>"test" | "live": the ONVO mode the row was created in. Rows only count in the matching mode.</summary>
    public string OnvoMode { get; set; } = string.Empty;

    public string OnvoCustomerId { get; set; } = string.Empty;
    public string OnvoSubscriptionId { get; set; } = string.Empty;

    /// <summary>"monthly" | "yearly" (see BillingPlans).</summary>
    public string PlanCode { get; set; } = string.Empty;

    /// <summary>Price the plan was sold at, in minor units. Renewals are verified against THIS, not the current catalogue.</summary>
    public int PriceCents { get; set; }

    public string Currency { get; set; } = string.Empty;

    /// <summary>ONVO status, mirrored verbatim: incomplete, active, past_due, unpaid, canceled, incomplete_expired, trialing.</summary>
    public string Status { get; set; } = string.Empty;

    public bool CancelAtPeriodEnd { get; set; }

    public DateTime? CurrentPeriodStartUtc { get; set; }
    public DateTime? CurrentPeriodEndUtc { get; set; }

    /// <summary>
    /// End of the last period with a verified payment that still stands.
    /// NULL = never paid, or the last payment was fully refunded.
    /// </summary>
    public DateTime? PaidThroughUtc { get; set; }

    /// <summary>Payment intent behind <see cref="PaidThroughUtc"/>; tells a renewal from a re-sync.</summary>
    public string? LastPaymentIntentId { get; set; }

    public DateTime? CanceledAtUtc { get; set; }
    public DateTime? LastSyncedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    // Navigation
    public User User { get; set; } = null!;
}
