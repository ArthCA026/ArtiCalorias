using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Billing;

public static class BillingAccessReasons
{
    public const string Subscription = "subscription";
    public const string Grace = "grace";
    public const string Whitelist = "whitelist";
    public const string BillingDisabled = "billing_disabled";
    public const string None = "none";
}

/// <summary>Everything the client needs to gate the app and draw the subscription screens.</summary>
public class BillingStatusResponse
{
    /// <summary>False: subscriptions are switched off on this server; the client hides every billing screen.</summary>
    public bool BillingEnabled { get; set; }

    public bool HasAccess { get; set; }

    /// <summary>"subscription" | "grace" | "whitelist" | "billing_disabled" | "none".</summary>
    public string AccessReason { get; set; } = BillingAccessReasons.None;

    /// <summary>"test" | "live"; null when ONVO keys are not configured. "test" = no real money moves.</summary>
    public string? Mode { get; set; }

    /// <summary>False when payments cannot be taken right now (keys missing or mismatched).</summary>
    public bool CheckoutAvailable { get; set; }

    /// <summary>The subscription that matters most right now. Null when the account never paid.</summary>
    public BillingSubscriptionDto? Subscription { get; set; }

    public List<BillingPlanDto> Plans { get; set; } = [];

    /// <summary>Days with food logged, sent only to accounts without access (their data is safe and waiting).</summary>
    public int? DaysLogged { get; set; }
}

public class BillingSubscriptionDto
{
    /// <summary>"monthly" | "yearly".</summary>
    public string Plan { get; set; } = string.Empty;

    public int PriceCents { get; set; }
    public string Currency { get; set; } = string.Empty;

    /// <summary>"active" | "past_due" | "canceling" | "ended".</summary>
    public string State { get; set; } = string.Empty;

    /// <summary>End of the paid period: the next charge date while renewing, the last day when canceling.</summary>
    public DateTime? PaidThroughUtc { get; set; }

    /// <summary>When access actually stops (paid period plus any grace).</summary>
    public DateTime? AccessUntilUtc { get; set; }

    public DateTime StartedAtUtc { get; set; }
    public bool CancelAtPeriodEnd { get; set; }

    /// <summary>True when a cancellation can still be undone without paying again.</summary>
    public bool CanResume { get; set; }

    /// <summary>True when the plan ended because the renewal could not be charged, not because the user left.</summary>
    public bool EndedByPaymentFailure { get; set; }
}

public class BillingPlanDto
{
    public string Code { get; set; } = string.Empty;
    public int PriceCents { get; set; }
    public string Currency { get; set; } = string.Empty;

    /// <summary>"month" | "year".</summary>
    public string Interval { get; set; } = string.Empty;
}

public class StartCheckoutRequest
{
    [Required]
    [MaxLength(16)]
    public string Plan { get; set; } = string.Empty;

    /// <summary>UI language the offer was shown in ("en" | "es"); recorded with the checkout evidence.</summary>
    [MaxLength(5)]
    public string? Locale { get; set; }

    /// <summary>
    /// Version of the Terms of Use on screen when the user asked to pay. Must be
    /// the current one: nobody is charged under terms they were not shown.
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string AcceptedTermsVersion { get; set; } = string.Empty;
}

/// <summary>What ONVO's browser SDK needs to render the card form for this purchase.</summary>
public class StartCheckoutResponse
{
    public string SubscriptionId { get; set; } = string.Empty;
    public string CustomerId { get; set; } = string.Empty;
    public string PublishableKey { get; set; } = string.Empty;
    public string Mode { get; set; } = string.Empty;
    public string Plan { get; set; } = string.Empty;
    public int PriceCents { get; set; }
    public string Currency { get; set; } = string.Empty;
}
