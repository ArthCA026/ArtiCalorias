using Articalorias.Models.Entities;

namespace Articalorias.Services.Billing;

/// <summary>What the client needs to know about a subscription, free of ONVO vocabulary.</summary>
public static class SubscriptionStates
{
    /// <summary>Paid and renewing on its own.</summary>
    public const string Active = "active";

    /// <summary>A renewal is overdue or was declined; access continues for the grace window.</summary>
    public const string PastDue = "past_due";

    /// <summary>The user cancelled: paid time remains, nothing renews. Can be resumed.</summary>
    public const string Canceling = "canceling";

    /// <summary>Was paid once, grants nothing now.</summary>
    public const string Ended = "ended";
}

public sealed record AccessDecision(bool HasAccess, bool InGrace, DateTime? AccessUntilUtc, string State);

/// <summary>
/// The access rule, as a pure function of one subscription row and the clock.
/// Everything is an instant in UTC, so the answer is the same in every time
/// zone; only the client turns <see cref="AccessDecision.AccessUntilUtc"/> into
/// a local calendar date for display.
///
/// Access follows what was PAID FOR, never the ONVO status alone: like Stripe,
/// ONVO moves a subscription into its next period when the renewal is due,
/// whether or not the charge went through, so "active until currentPeriodEnd"
/// would hand out unpaid time.
/// </summary>
public static class SubscriptionAccess
{
    public static AccessDecision Evaluate(UserSubscription subscription, DateTime nowUtc)
    {
        if (subscription.PaidThroughUtc is not { } paidThrough)
            return new AccessDecision(false, false, null, SubscriptionStates.Ended);

        var renewalExpected = IsRenewalExpected(subscription);
        var accessUntil = renewalExpected
            ? paidThrough.AddDays(BillingPlans.RenewalGraceDays)
            : paidThrough;

        if (nowUtc >= accessUntil)
            return new AccessDecision(false, false, accessUntil, SubscriptionStates.Ended);

        var inGrace = nowUtc >= paidThrough;

        string state;
        if (!renewalExpected)
            state = SubscriptionStates.Canceling;
        else if (subscription.Status == OnvoSubscriptionStatuses.PastDue || inGrace)
            state = SubscriptionStates.PastDue;
        else
            state = SubscriptionStates.Active;

        return new AccessDecision(true, inGrace, accessUntil, state);
    }

    /// <summary>
    /// True while ONVO will still try to charge the next period. Once the user
    /// cancelled, or ONVO gave up (unpaid, canceled, expired), there is nothing
    /// to wait for and therefore no grace.
    /// </summary>
    public static bool IsRenewalExpected(UserSubscription subscription) =>
        !subscription.CancelAtPeriodEnd &&
        subscription.Status is OnvoSubscriptionStatuses.Active or OnvoSubscriptionStatuses.PastDue;

    /// <summary>The row that serves the user best: the one granting access the longest, else the most recent.</summary>
    public static UserSubscription? PickBest(IEnumerable<UserSubscription> subscriptions, DateTime nowUtc)
    {
        return subscriptions
            .Where(s => s.PaidThroughUtc is not null)
            .Select(s => new { Row = s, Decision = Evaluate(s, nowUtc) })
            .OrderByDescending(x => x.Decision.HasAccess)
            .ThenByDescending(x => x.Decision.AccessUntilUtc)
            .ThenByDescending(x => x.Row.UserSubscriptionId)
            .Select(x => x.Row)
            .FirstOrDefault();
    }
}
