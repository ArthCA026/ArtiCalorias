using Articalorias.Configuration;
using Articalorias.Data;
using Articalorias.DTOs.Billing;
using Articalorias.Exceptions;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Articalorias.Services.Billing;

public static class BillingEventTypes
{
    public const string CheckoutStarted = "checkout_started";
    public const string Activated = "activated";
    public const string Renewed = "renewed";
    public const string RenewalFailed = "renewal_failed";
    public const string CancelRequested = "cancel_requested";
    public const string Resumed = "resumed";
    public const string Refunded = "refunded";
    public const string PaymentMismatch = "payment_mismatch";
    public const string Superseded = "superseded";
}

/// <summary>
/// Subscription billing through ONVO Pay.
///
/// Two rules shape everything here:
///  1. ONVO is the source of truth and it is only ever READ with the secret
///     key. A webhook, or the browser saying "payment succeeded", is a reason
///     to re-read a subscription, never a fact to store. The webhook secret is
///     a shared static value and the browser is the customer's.
///  2. Access is granted for periods whose payment was verified against the
///     price the plan was sold at (<see cref="UserSubscription.PaidThroughUtc"/>),
///     so an edited checkout, a declined renewal or a refund can never turn
///     into free time.
/// </summary>
public class BillingService : IBillingService
{
    private static readonly TimeSpan AccessCacheTtl = TimeSpan.FromMinutes(5);

    /// <summary>An unpaid checkout younger than this is reused instead of creating another ONVO subscription.</summary>
    private static readonly TimeSpan ReusableCheckoutAge = TimeSpan.FromHours(20);

    /// <summary>How long an unpaid checkout is still worth re-reading when the app opens (a payment whose confirmation was lost).</summary>
    private static readonly TimeSpan UnpaidCheckoutWatch = TimeSpan.FromHours(48);

    private static readonly TimeSpan RefreshWhenDueEvery = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan RefreshRoutineEvery = TimeSpan.FromHours(24);

    private const int MaxRowsPerSync = 3;
    private const int CheckoutsPerHour = 10;
    private const int SyncsPerHour = 40;
    private const int CancelsPerHour = 10;

    private readonly AppDbContext _db;
    private readonly IOnvoClient _onvo;
    private readonly BillingSettings _billing;
    private readonly OnvoSettings _onvoSettings;
    private readonly IMemoryCache _cache;
    private readonly IPushNotificationService _push;
    private readonly ILogger<BillingService> _logger;

    public BillingService(
        AppDbContext db,
        IOnvoClient onvo,
        IOptions<BillingSettings> billing,
        IOptions<OnvoSettings> onvoSettings,
        IMemoryCache cache,
        IPushNotificationService push,
        ILogger<BillingService> logger)
    {
        _db = db;
        _onvo = onvo;
        _billing = billing.Value;
        _onvoSettings = onvoSettings.Value;
        _cache = cache;
        _push = push;
        _logger = logger;
    }

    // ── Access ────────────────────────────────────────────────────────────────

    public async Task<bool> HasAccessAsync(long userId, CancellationToken ct = default)
    {
        if (!_billing.Enabled || SubscriptionWhitelist.Contains(userId))
            return true;

        var key = AccessCacheKey(userId);
        if (_cache.TryGetValue(key, out bool cached))
            return cached;

        var now = DateTime.UtcNow;
        var decision = await EvaluateStoredAccessAsync(userId, now, ct);

        // Never cache a "yes" past the moment it stops being true.
        var ttl = AccessCacheTtl;
        if (decision is { HasAccess: true, AccessUntilUtc: { } until } && until - now < ttl)
            ttl = until - now;
        if (ttl > TimeSpan.Zero)
            _cache.Set(key, decision?.HasAccess ?? false, ttl);

        return decision?.HasAccess ?? false;
    }

    private async Task<AccessDecision?> EvaluateStoredAccessAsync(long userId, DateTime nowUtc, CancellationToken ct)
    {
        var mode = _onvoSettings.Mode;
        if (mode is null)
            return null; // no keys, so no stored subscription can be vouched for

        var rows = await _db.UserSubscriptions
            .AsNoTracking()
            .Where(s => s.UserId == userId && s.OnvoMode == mode && s.PaidThroughUtc != null)
            .ToListAsync(ct);

        var best = SubscriptionAccess.PickBest(rows, nowUtc);
        return best is null ? null : SubscriptionAccess.Evaluate(best, nowUtc);
    }

    // ── Status ────────────────────────────────────────────────────────────────

    public async Task<BillingStatusResponse> GetStatusAsync(long userId, CancellationToken ct = default)
    {
        var rows = await LoadRowsAsync(userId, ct);
        await RefreshDueRowsAsync(rows, ct);
        return await BuildStatusAsync(userId, rows, ct);
    }

    private async Task<BillingStatusResponse> BuildStatusAsync(long userId, List<UserSubscription> rows, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var best = SubscriptionAccess.PickBest(rows, now);
        var decision = best is null ? null : SubscriptionAccess.Evaluate(best, now);
        var whitelisted = SubscriptionWhitelist.Contains(userId);

        var response = new BillingStatusResponse
        {
            BillingEnabled = _billing.Enabled,
            Mode = _onvoSettings.Mode,
            CheckoutAvailable = _billing.Enabled && _onvoSettings.IsCheckoutConfigured,
            Plans = BillingPlans.All
                .Select(p => new BillingPlanDto
                {
                    Code = p.Code,
                    PriceCents = p.PriceCents,
                    Currency = p.Currency,
                    Interval = p.OnvoInterval
                })
                .ToList()
        };

        if (best is not null && decision is not null)
        {
            response.Subscription = new BillingSubscriptionDto
            {
                Plan = best.PlanCode,
                PriceCents = best.PriceCents,
                Currency = best.Currency,
                State = decision.State,
                PaidThroughUtc = Utc(best.PaidThroughUtc),
                AccessUntilUtc = Utc(decision.AccessUntilUtc),
                StartedAtUtc = Utc(best.CreatedAtUtc),
                CancelAtPeriodEnd = best.CancelAtPeriodEnd,
                CanResume = decision.HasAccess && best.CancelAtPeriodEnd &&
                            best.Status == OnvoSubscriptionStatuses.Active,
                EndedByPaymentFailure = !decision.HasAccess &&
                            best.Status is OnvoSubscriptionStatuses.PastDue or OnvoSubscriptionStatuses.Unpaid
            };
        }

        if (!_billing.Enabled)
        {
            response.HasAccess = true;
            response.AccessReason = BillingAccessReasons.BillingDisabled;
        }
        else if (whitelisted)
        {
            response.HasAccess = true;
            response.AccessReason = BillingAccessReasons.Whitelist;
        }
        else if (decision is { HasAccess: true })
        {
            response.HasAccess = true;
            response.AccessReason = decision.InGrace ? BillingAccessReasons.Grace : BillingAccessReasons.Subscription;
        }
        else
        {
            response.HasAccess = false;
            response.AccessReason = BillingAccessReasons.None;

            // Shown on the paywall: what is waiting behind it is real, logged data.
            response.DaysLogged = await _db.DailyLogs
                .CountAsync(d => d.UserId == userId && (d.TotalFoodCaloriesKcal > 0 || d.IsFastingDay), ct);
        }

        return response;
    }

    /// <summary>
    /// Re-reads from ONVO the rows whose local copy is due. This is what makes
    /// the system correct WITHOUT webhooks: a renewal, a dashboard cancellation
    /// or a refund is picked up the next time the user opens the app. ONVO
    /// being unreachable never breaks the status call; the grace window covers
    /// a paying user until the next attempt.
    /// </summary>
    private async Task RefreshDueRowsAsync(List<UserSubscription> rows, CancellationToken ct)
    {
        if (!_onvoSettings.HasSecretKey)
            return;

        var now = DateTime.UtcNow;
        foreach (var row in rows.Where(r => IsRefreshDue(r, now)).Take(MaxRowsPerSync))
        {
            try
            {
                await SyncRowAsync(row, ct);
            }
            catch (OnvoException ex)
            {
                _logger.LogWarning(ex,
                    "Billing: background refresh of subscription {SubscriptionId} (user {UserId}) failed; serving the stored state.",
                    row.OnvoSubscriptionId, row.UserId);
            }
        }
    }

    private static bool IsRefreshDue(UserSubscription row, DateTime nowUtc)
    {
        if (OnvoSubscriptionStatuses.IsTerminal(row.Status))
            return false;

        var sinceSync = nowUtc - (row.LastSyncedAtUtc ?? DateTime.MinValue);

        if (row.PaidThroughUtc is not { } paidThrough)
        {
            // An unpaid checkout is watched for two days (a payment whose
            // confirmation got lost). A refunded plan ONVO still renews is
            // watched for as long as it lives: its next charge must be seen.
            var watched = SubscriptionAccess.IsRenewalExpected(row) ||
                          nowUtc - row.CreatedAtUtc < UnpaidCheckoutWatch;
            return watched && sinceSync > RefreshWhenDueEvery;
        }

        // Past the paid period: a renewal, a failed charge or the end of a
        // cancelled plan is waiting to be read.
        return nowUtc >= paidThrough ? sinceSync > RefreshWhenDueEvery : sinceSync > RefreshRoutineEvery;
    }

    // ── Checkout ──────────────────────────────────────────────────────────────

    public async Task<StartCheckoutResponse> StartCheckoutAsync(long userId, StartCheckoutRequest request, CancellationToken ct = default)
    {
        if (!_billing.Enabled || SubscriptionWhitelist.Contains(userId))
            throw new ApiException(ErrorCodes.SubscriptionNotRequired,
                "This account does not need a subscription.", StatusCodes.Status409Conflict);

        var plan = BillingPlans.Find(request.Plan)
            ?? throw new ApiException(ErrorCodes.InvalidInput, "Unknown subscription plan.");

        if (request.AcceptedTermsVersion != PolicyVersions.Terms)
            throw new ApiException(ErrorCodes.ConsentVersionStale,
                "The terms shown are out of date. Please reload the app and review the current version before paying.");

        // The subscription terms live in the Terms of Use: nobody is charged
        // without a recorded acceptance of the current version.
        var latestTerms = await _db.UserConsents.AsNoTracking()
            .Where(c => c.UserId == userId && c.ConsentType == ConsentTypes.Terms)
            .OrderByDescending(c => c.CreatedAtUtc)
            .ThenByDescending(c => c.UserConsentId)
            .FirstOrDefaultAsync(ct);
        if (latestTerms is not { Action: ConsentActions.Granted } || latestTerms.PolicyVersion != PolicyVersions.Terms)
            throw new ApiException(ErrorCodes.ConsentRequired,
                "Please accept the current terms before subscribing.", StatusCodes.Status403Forbidden);

        if (!_onvoSettings.IsCheckoutConfigured || _onvoSettings.Mode is not { } mode)
        {
            _logger.LogError("Billing: checkout requested but the ONVO keys are missing or belong to different modes.");
            throw new ApiException(ErrorCodes.BillingUnavailable,
                "Payments are temporarily unavailable. Please try again later.",
                StatusCodes.Status503ServiceUnavailable);
        }

        EnforceRateLimit($"billing-rl:checkout:{userId}", CheckoutsPerHour);

        var rows = await LoadRowsAsync(userId, ct);
        var now = DateTime.UtcNow;

        try
        {
            // A checkout paid a moment ago in another tab must be seen before
            // offering to pay again.
            foreach (var row in rows.Where(r => !OnvoSubscriptionStatuses.IsTerminal(r.Status) &&
                                                (r.PaidThroughUtc is null || now >= r.PaidThroughUtc))
                                    .Take(MaxRowsPerSync))
            {
                await SyncRowAsync(row, ct);
            }

            var best = SubscriptionAccess.PickBest(rows, now);
            if (best is not null)
            {
                var decision = SubscriptionAccess.Evaluate(best, now);
                if (decision.HasAccess && decision.State != SubscriptionStates.PastDue)
                    throw new ApiException(ErrorCodes.AlreadySubscribed,
                        decision.State == SubscriptionStates.Canceling
                            ? "Your subscription is still running. Resume it instead of paying again."
                            : "You already have an active subscription.",
                        StatusCodes.Status409Conflict);
            }

            var unpaid = rows
                .Where(r => r.PaidThroughUtc is null && r.Status == OnvoSubscriptionStatuses.Incomplete)
                .ToList();

            var reusable = unpaid.FirstOrDefault(r =>
                r.PlanCode == plan.Code && r.PriceCents == plan.PriceCents && r.Currency == plan.Currency &&
                now - r.CreatedAtUtc < ReusableCheckoutAge);

            // Any other open checkout is closed first: two card forms for two
            // plans must never both be payable.
            foreach (var stale in unpaid.Where(r => r != reusable))
                await CancelAtProviderBestEffortAsync(stale, "replaced by a new checkout", ct);

            if (reusable is not null)
                return ToCheckoutResponse(reusable, mode);

            var user = await _db.Users.AsNoTracking()
                .Where(u => u.UserId == userId)
                .Select(u => new { u.Username, u.Email })
                .FirstOrDefaultAsync(ct)
                ?? throw new UnauthorizedAccessException();

            var knownCustomerId = rows.Select(r => r.OnvoCustomerId).FirstOrDefault();
            var (customerId, subscription) = await CreateProviderSubscriptionAsync(
                userId, user.Username, user.Email, plan, mode, knownCustomerId, ct);

            var created = new UserSubscription
            {
                UserId = userId,
                OnvoMode = mode,
                OnvoCustomerId = customerId,
                OnvoSubscriptionId = subscription.Id,
                PlanCode = plan.Code,
                PriceCents = plan.PriceCents,
                Currency = plan.Currency,
                Status = subscription.Status ?? OnvoSubscriptionStatuses.Incomplete,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
                LastSyncedAtUtc = now
            };
            _db.UserSubscriptions.Add(created);

            try
            {
                await _db.SaveChangesAsync(ct);
            }
            catch (Exception)
            {
                // Never leave a payable subscription at ONVO that this database does not know about.
                try { await _onvo.CancelSubscriptionAsync(subscription.Id, CancellationToken.None); }
                catch (OnvoException cancelEx)
                {
                    _logger.LogError(cancelEx,
                        "Billing: ORPHANED ONVO subscription {SubscriptionId} for user {UserId}; cancel it in the ONVO dashboard.",
                        subscription.Id, userId);
                }
                throw;
            }

            await RecordEventAsync(userId, created.UserSubscriptionId, BillingEventTypes.CheckoutStarted, null,
                $"plan={plan.Code}; price={plan.PriceCents} {plan.Currency}; renews every {plan.OnvoInterval}; " +
                $"terms={request.AcceptedTermsVersion}; locale={ConsentLocales.Normalize(request.Locale)}; mode={mode}", ct);

            return ToCheckoutResponse(created, mode);
        }
        catch (OnvoException ex)
        {
            throw ProviderUnavailable(ex, "start the payment");
        }
    }

    private StartCheckoutResponse ToCheckoutResponse(UserSubscription row, string mode) => new()
    {
        SubscriptionId = row.OnvoSubscriptionId,
        CustomerId = row.OnvoCustomerId,
        PublishableKey = _onvoSettings.PublishableKey,
        Mode = mode,
        Plan = row.PlanCode,
        PriceCents = row.PriceCents,
        Currency = row.Currency
    };

    /// <summary>
    /// Customer + price + unpaid subscription at ONVO. The cached price and the
    /// remembered customer can both go stale (keys swapped to another ONVO
    /// account); ONVO then rejects them with a 4xx and the whole set is minted
    /// again, once.
    /// </summary>
    private async Task<(string CustomerId, OnvoSubscription Subscription)> CreateProviderSubscriptionAsync(
        long userId, string username, string email, BillingPlan plan, string mode, string? knownCustomerId,
        CancellationToken ct)
    {
        var metadata = new Dictionary<string, string>
        {
            ["app"] = "articalorias",
            ["userId"] = userId.ToString(),
            ["plan"] = plan.Code
        };
        var description = $"ArtiCalorias ({plan.Code})";

        for (var attempt = 0; ; attempt++)
        {
            var fresh = attempt > 0;
            var priceId = await GetOrCreatePriceIdAsync(plan, mode, forceNew: fresh, ct);
            var customerId = !fresh && knownCustomerId is not null
                ? knownCustomerId
                : (await _onvo.CreateCustomerAsync(username, email, ct)).Id;

            try
            {
                var subscription = await _onvo.CreateIncompleteSubscriptionAsync(customerId, priceId, description, metadata, ct);
                return (customerId, subscription);
            }
            catch (OnvoException ex) when (ex.IsClientError && attempt == 0)
            {
                _logger.LogWarning(ex,
                    "Billing: ONVO rejected the stored price or customer for user {UserId}; recreating both.", userId);
            }
        }
    }

    private async Task<string> GetOrCreatePriceIdAsync(BillingPlan plan, string mode, bool forceNew, CancellationToken ct)
    {
        var cacheKey = $"billing-price:{mode}:{plan.Code}:{plan.Currency}:{plan.PriceCents}";
        if (!forceNew && _cache.TryGetValue(cacheKey, out string? cachedId) && cachedId is not null)
            return cachedId;

        var stored = await _db.BillingPrices.FirstOrDefaultAsync(p =>
            p.OnvoMode == mode && p.PlanCode == plan.Code &&
            p.Currency == plan.Currency && p.UnitAmountCents == plan.PriceCents, ct);

        if (stored is not null && !forceNew)
        {
            _cache.Set(cacheKey, stored.OnvoPriceId, TimeSpan.FromHours(12));
            return stored.OnvoPriceId;
        }

        if (stored is not null)
        {
            _db.BillingPrices.Remove(stored);
            await _db.SaveChangesAsync(ct);
            _cache.Remove(cacheKey);
        }

        // One ONVO product, one price per plan. A forced refresh gets its own
        // product too, since the old one may belong to another ONVO account.
        var productId = forceNew
            ? null
            : await _db.BillingPrices.Where(p => p.OnvoMode == mode).Select(p => p.OnvoProductId).FirstOrDefaultAsync(ct);
        productId ??= (await _onvo.CreateProductAsync(
            "ArtiCalorias", "ArtiCalorias subscription: calorie, macro and body tracking.", ct)).Id;

        var price = await _onvo.CreateRecurringPriceAsync(
            productId, plan.PriceCents, plan.Currency, plan.OnvoInterval, $"ArtiCalorias {plan.Code}", ct);

        var row = new BillingPrice
        {
            OnvoMode = mode,
            PlanCode = plan.Code,
            Currency = plan.Currency,
            UnitAmountCents = plan.PriceCents,
            OnvoProductId = productId,
            OnvoPriceId = price.Id,
            CreatedAtUtc = DateTime.UtcNow
        };
        _db.BillingPrices.Add(row);

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Lost the race with a concurrent first checkout: use the winner's price.
            _db.Entry(row).State = EntityState.Detached;
            var winner = await _db.BillingPrices.AsNoTracking().FirstOrDefaultAsync(p =>
                p.OnvoMode == mode && p.PlanCode == plan.Code &&
                p.Currency == plan.Currency && p.UnitAmountCents == plan.PriceCents, ct);
            if (winner is null)
                throw;
            _cache.Set(cacheKey, winner.OnvoPriceId, TimeSpan.FromHours(12));
            return winner.OnvoPriceId;
        }

        _cache.Set(cacheKey, price.Id, TimeSpan.FromHours(12));
        return price.Id;
    }

    // ── Sync ──────────────────────────────────────────────────────────────────

    public async Task<BillingStatusResponse> SyncAsync(long userId, CancellationToken ct = default)
    {
        EnforceRateLimit($"billing-rl:sync:{userId}", SyncsPerHour);

        var rows = await LoadRowsAsync(userId, ct);
        OnvoException? failure = null;

        if (_onvoSettings.HasSecretKey)
        {
            foreach (var row in rows.Where(r => !OnvoSubscriptionStatuses.IsTerminal(r.Status)).Take(MaxRowsPerSync))
            {
                try
                {
                    await SyncRowAsync(row, ct);
                }
                catch (OnvoException ex)
                {
                    failure = ex;
                }
            }
        }

        var status = await BuildStatusAsync(userId, rows, ct);

        // A failed re-read only matters when it may be hiding a payment.
        if (failure is not null && !status.HasAccess)
            throw ProviderUnavailable(failure, "confirm your payment");

        return status;
    }

    /// <summary>
    /// Copies one subscription's state from ONVO and, when its latest invoice is
    /// paid, verifies the money before extending <see cref="UserSubscription.PaidThroughUtc"/>.
    /// Idempotent by construction: it copies state, it never adds time, so a
    /// redelivered webhook, an out-of-order event or two racing callers all
    /// converge on the same row.
    /// </summary>
    private async Task SyncRowAsync(UserSubscription row, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        OnvoSubscription remote;
        try
        {
            remote = await _onvo.GetSubscriptionAsync(row.OnvoSubscriptionId, ct);
        }
        catch (OnvoException ex) when (ex.IsNotFound)
        {
            // Gone at ONVO (or the keys now belong to another account): nothing
            // will renew. Time already paid for stays valid.
            _logger.LogWarning("Billing: subscription {SubscriptionId} no longer exists at ONVO; marking it canceled.",
                row.OnvoSubscriptionId);
            row.Status = OnvoSubscriptionStatuses.Canceled;
            row.CanceledAtUtc ??= now;
            await SaveRowAsync(row, now, ct);
            return;
        }

        if ((remote.CustomerId is not null && remote.CustomerId != row.OnvoCustomerId) ||
            (remote.Mode is not null && remote.Mode != row.OnvoMode))
        {
            _logger.LogError(
                "Billing: subscription {SubscriptionId} does not match its stored customer or mode (user {UserId}); ignoring it.",
                row.OnvoSubscriptionId, row.UserId);
            return;
        }

        row.Status = string.IsNullOrWhiteSpace(remote.Status) ? row.Status : remote.Status;
        row.CancelAtPeriodEnd = remote.CancelAtPeriodEnd ?? false;
        row.CurrentPeriodStartUtc = remote.CurrentPeriodStartUtc ?? row.CurrentPeriodStartUtc;
        row.CurrentPeriodEndUtc = remote.CurrentPeriodEndUtc ?? row.CurrentPeriodEndUtc;
        row.CanceledAtUtc = remote.CanceledAtUtc ?? row.CanceledAtUtc;

        string? newEvent = null;
        string? eventKey = null;
        string? eventDetail = null;

        var invoice = remote.LatestInvoice;
        if (invoice is { IsPaid: true } && !string.IsNullOrWhiteSpace(invoice.PaymentIntentId))
        {
            var intent = await _onvo.GetPaymentIntentAsync(invoice.PaymentIntentId, ct);
            eventKey = intent.Id;

            if (string.Equals(intent.Status, "refunded", StringComparison.OrdinalIgnoreCase))
            {
                // A fully refunded period is not a paid period. The grant is
                // cleared outright rather than moved back to the period start:
                // the subscription is usually still "active" at ONVO, and a
                // date in the recent past would hand the refunded user the
                // renewal grace window. Earlier periods are over by
                // definition, so nothing legitimate is lost, and the next
                // paid renewal sets it again.
                if (row.LastPaymentIntentId == intent.Id && row.PaidThroughUtc is not null)
                {
                    newEvent = BillingEventTypes.Refunded;
                    eventDetail = $"intent={intent.Id}; revokedPaidThrough={row.PaidThroughUtc:O}";
                    row.PaidThroughUtc = null;
                }
            }
            else if (PaymentCovers(intent, row))
            {
                var plan = BillingPlans.Find(row.PlanCode);
                var periodEnd = ResolvePaidPeriodEnd(invoice, remote, plan, now, row);
                var isNewPayment = row.LastPaymentIntentId != intent.Id;

                if (row.PaidThroughUtc is null || periodEnd > row.PaidThroughUtc)
                    row.PaidThroughUtc = periodEnd;

                if (isNewPayment)
                {
                    newEvent = row.LastPaymentIntentId is null ? BillingEventTypes.Activated : BillingEventTypes.Renewed;
                    eventDetail = $"intent={intent.Id}; amount={intent.Amount} {intent.Currency}; paidThrough={periodEnd:O}";
                }
                row.LastPaymentIntentId = intent.Id;
            }
            else
            {
                _logger.LogError(
                    "Billing: PAYMENT MISMATCH on subscription {SubscriptionId} (user {UserId}): intent {IntentId} is {Status} for {Amount} {Currency}, expected at least {Expected} {ExpectedCurrency}. No access granted.",
                    row.OnvoSubscriptionId, row.UserId, intent.Id, intent.Status, intent.Amount, intent.Currency,
                    row.PriceCents, row.Currency);
                newEvent = BillingEventTypes.PaymentMismatch;
                eventDetail = $"intent={intent.Id}; status={intent.Status}; amount={intent.Amount} {intent.Currency}; expected={row.PriceCents} {row.Currency}";
            }
        }

        await SaveRowAsync(row, now, ct);

        if (newEvent is null)
            return;

        var firstTime = await RecordEventAsync(row.UserId, row.UserSubscriptionId, newEvent, eventKey, eventDetail, ct);
        if (firstTime && newEvent is BillingEventTypes.Activated or BillingEventTypes.Renewed)
            await RetireOtherSubscriptionsAsync(row, ct);
    }

    /// <summary>
    /// The money check. The browser holds the publishable key, which ONVO lets
    /// add items to an unconfirmed subscription, so "the SDK reported success"
    /// proves nothing about the amount: only a settled intent for at least the
    /// price this plan was sold at, in its currency, from its customer, counts.
    /// </summary>
    private static bool PaymentCovers(OnvoPaymentIntent intent, UserSubscription row)
    {
        var settled = string.Equals(intent.Status, "succeeded", StringComparison.OrdinalIgnoreCase) ||
                      string.Equals(intent.Status, "partially_refunded", StringComparison.OrdinalIgnoreCase);

        return settled &&
               string.Equals(intent.Currency, row.Currency, StringComparison.OrdinalIgnoreCase) &&
               intent.Amount is { } amount && amount >= row.PriceCents &&
               (intent.CustomerId is null || intent.CustomerId == row.OnvoCustomerId);
    }

    private DateTime ResolvePaidPeriodEnd(
        OnvoInvoice invoice, OnvoSubscription remote, BillingPlan? plan, DateTime nowUtc, UserSubscription row)
    {
        var periodStart = invoice.PeriodStartUtc ?? remote.CurrentPeriodStartUtc ?? nowUtc;
        var periodEnd = invoice.PeriodEndUtc ?? remote.CurrentPeriodEndUtc;

        if (periodEnd is null || periodEnd <= periodStart)
        {
            var fallback = plan?.AddOnePeriod(periodStart) ?? periodStart.AddMonths(1);
            _logger.LogWarning(
                "Billing: ONVO reported a paid invoice without usable period dates on {SubscriptionId}; using {Fallback:O}.",
                row.OnvoSubscriptionId, fallback);
            periodEnd = fallback;
        }

        // One payment buys one period. A date further out than that is bad data, not a gift.
        var ceiling = nowUtc + (plan?.MaxPeriod ?? TimeSpan.FromDays(31)) + TimeSpan.FromDays(2);
        if (periodEnd > ceiling)
        {
            _logger.LogWarning(
                "Billing: period end {PeriodEnd:O} on {SubscriptionId} is beyond one {Plan} period; clamped to {Ceiling:O}.",
                periodEnd, row.OnvoSubscriptionId, row.PlanCode, ceiling);
            periodEnd = ceiling;
        }

        return periodEnd.Value;
    }

    /// <summary>
    /// A new payment landed on <paramref name="paid"/>: nothing else of this
    /// user's may keep charging. Covers the card-fix flow (the declined
    /// subscription ONVO is still retrying) and any duplicate. Time already
    /// paid on the retired rows stays valid. Best effort: a failure is logged
    /// with the ids needed to finish the job by hand.
    /// </summary>
    private async Task RetireOtherSubscriptionsAsync(UserSubscription paid, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var others = await _db.UserSubscriptions
            .Where(s => s.UserId == paid.UserId && s.OnvoMode == paid.OnvoMode &&
                        s.UserSubscriptionId != paid.UserSubscriptionId)
            .ToListAsync(ct);

        foreach (var other in others.Where(o => !OnvoSubscriptionStatuses.IsTerminal(o.Status)))
        {
            var paidAhead = other.PaidThroughUtc is { } until && until > now;
            if (paidAhead && other.Status == OnvoSubscriptionStatuses.Active)
            {
                if (other.CancelAtPeriodEnd)
                    continue;

                _logger.LogError(
                    "Billing: user {UserId} holds two paid subscriptions ({Kept} and {Other}); stopping the renewal of {Other}.",
                    paid.UserId, paid.OnvoSubscriptionId, other.OnvoSubscriptionId, other.OnvoSubscriptionId);
                try
                {
                    var updated = await _onvo.SetCancelAtPeriodEndAsync(other.OnvoSubscriptionId, true, ct);
                    other.CancelAtPeriodEnd = updated.CancelAtPeriodEnd ?? true;
                    await SaveRowAsync(other, now, ct);
                }
                catch (OnvoException ex)
                {
                    _logger.LogError(ex, "Billing: could not stop the renewal of duplicate subscription {SubscriptionId}.",
                        other.OnvoSubscriptionId);
                }
                continue;
            }

            await CancelAtProviderBestEffortAsync(other, $"superseded by {paid.OnvoSubscriptionId}", ct);
        }
    }

    private async Task CancelAtProviderBestEffortAsync(UserSubscription row, string reason, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        try
        {
            await _onvo.CancelSubscriptionAsync(row.OnvoSubscriptionId, ct);
        }
        catch (OnvoException ex) when (ex.IsNotFound)
        {
            // Already gone: same outcome.
        }
        catch (OnvoException ex)
        {
            _logger.LogError(ex,
                "Billing: could not cancel subscription {SubscriptionId} (user {UserId}, {Reason}). Cancel it in the ONVO dashboard.",
                row.OnvoSubscriptionId, row.UserId, reason);
            return;
        }

        row.Status = OnvoSubscriptionStatuses.Canceled;
        row.CanceledAtUtc ??= now;
        await SaveRowAsync(row, now, ct);
        await RecordEventAsync(row.UserId, row.UserSubscriptionId, BillingEventTypes.Superseded, null, reason, ct);
    }

    // ── Cancel / resume ───────────────────────────────────────────────────────

    public async Task<BillingStatusResponse> CancelAsync(long userId, CancellationToken ct = default)
    {
        // Deliberately NOT gated on Billing.Enabled: a subscriber must be able
        // to stop paying no matter how the server is configured.
        EnforceRateLimit($"billing-rl:cancel:{userId}", CancelsPerHour);

        var rows = await LoadRowsAsync(userId, ct);
        var targets = rows.Where(SubscriptionAccess.IsRenewalExpected).ToList();
        if (targets.Count == 0)
            throw new ApiException(ErrorCodes.NoSubscription,
                "There is no renewing subscription to cancel.", StatusCodes.Status409Conflict);

        var now = DateTime.UtcNow;
        foreach (var row in targets)
        {
            try
            {
                var paidAhead = row.PaidThroughUtc is { } until && until > now;
                OnvoSubscription result;

                if (paidAhead)
                {
                    result = await _onvo.SetCancelAtPeriodEndAsync(row.OnvoSubscriptionId, true, ct);
                    var accepted = result.CancelAtPeriodEnd == true ||
                                   result.Status == OnvoSubscriptionStatuses.Canceled;
                    if (!accepted)
                    {
                        // "Cancelled" must mean no further charge. If ONVO did
                        // not take the flag, cancel outright; the paid time is
                        // honoured locally either way.
                        _logger.LogWarning(
                            "Billing: ONVO did not apply cancelAtPeriodEnd on {SubscriptionId}; cancelling it immediately instead.",
                            row.OnvoSubscriptionId);
                        result = await _onvo.CancelSubscriptionAsync(row.OnvoSubscriptionId, ct);
                    }
                }
                else
                {
                    // Nothing paid ahead (a declined renewal being retried):
                    // stop the retries now.
                    result = await _onvo.CancelSubscriptionAsync(row.OnvoSubscriptionId, ct);
                }

                row.Status = string.IsNullOrWhiteSpace(result.Status) ? row.Status : result.Status;
                row.CancelAtPeriodEnd = result.CancelAtPeriodEnd ?? row.CancelAtPeriodEnd;
                row.CanceledAtUtc = result.CanceledAtUtc ?? row.CanceledAtUtc;

                // Whatever ONVO echoed back, the local row must stop expecting a renewal.
                if (SubscriptionAccess.IsRenewalExpected(row))
                {
                    if (paidAhead) row.CancelAtPeriodEnd = true;
                    else row.Status = OnvoSubscriptionStatuses.Canceled;
                }
            }
            catch (OnvoException ex) when (ex.IsNotFound)
            {
                row.Status = OnvoSubscriptionStatuses.Canceled;
                row.CanceledAtUtc ??= now;
            }
            catch (OnvoException ex)
            {
                // Never report a live subscription as cancelled.
                throw ProviderUnavailable(ex, "cancel your subscription. Nothing was changed");
            }

            await SaveRowAsync(row, now, ct);
            await RecordEventAsync(userId, row.UserSubscriptionId, BillingEventTypes.CancelRequested, null,
                $"paidThrough={row.PaidThroughUtc:O}; status={row.Status}; cancelAtPeriodEnd={row.CancelAtPeriodEnd}", ct);
        }

        return await BuildStatusAsync(userId, rows, ct);
    }

    public async Task<BillingStatusResponse> ResumeAsync(long userId, CancellationToken ct = default)
    {
        EnforceRateLimit($"billing-rl:cancel:{userId}", CancelsPerHour);

        var rows = await LoadRowsAsync(userId, ct);
        var now = DateTime.UtcNow;
        var row = rows.FirstOrDefault(r =>
            r.CancelAtPeriodEnd && r.Status == OnvoSubscriptionStatuses.Active &&
            r.PaidThroughUtc is { } until && until > now);

        if (row is null)
            throw new ApiException(ErrorCodes.NoSubscription,
                "There is no cancelled subscription that can still be resumed.", StatusCodes.Status409Conflict);

        try
        {
            var result = await _onvo.SetCancelAtPeriodEndAsync(row.OnvoSubscriptionId, false, ct);
            if (result.CancelAtPeriodEnd == true || result.Status != OnvoSubscriptionStatuses.Active)
                throw new ApiException(ErrorCodes.BillingProviderError,
                    "This subscription can no longer be resumed. You can subscribe again once it ends.",
                    StatusCodes.Status409Conflict);

            row.CancelAtPeriodEnd = false;
            row.Status = result.Status!;
        }
        catch (OnvoException ex)
        {
            throw ProviderUnavailable(ex, "resume your subscription");
        }

        await SaveRowAsync(row, now, ct);
        await RecordEventAsync(userId, row.UserSubscriptionId, BillingEventTypes.Resumed, null,
            $"paidThrough={row.PaidThroughUtc:O}", ct);

        return await BuildStatusAsync(userId, rows, ct);
    }

    // ── Webhook ───────────────────────────────────────────────────────────────

    public async Task<bool> HandleProviderEventAsync(
        string eventType, string? subscriptionId, string? customerId, CancellationToken ct = default)
    {
        UserSubscription? row = null;

        if (!string.IsNullOrWhiteSpace(subscriptionId))
            row = await _db.UserSubscriptions.FirstOrDefaultAsync(s => s.OnvoSubscriptionId == subscriptionId, ct);

        if (row is null && !string.IsNullOrWhiteSpace(customerId))
            row = await _db.UserSubscriptions
                .Where(s => s.OnvoCustomerId == customerId)
                .OrderByDescending(s => s.UserSubscriptionId)
                .FirstOrDefaultAsync(ct);

        // Not ours, or from the other ONVO mode (a test webhook on a live server).
        if (row is null || row.OnvoMode != _onvoSettings.Mode)
            return false;

        await SyncRowAsync(row, ct);

        if (eventType == "subscription.renewal.failed")
            await NotifyRenewalFailedAsync(row, ct);

        return true;
    }

    /// <summary>
    /// One push per failed charge, decided from the re-read state, not from the
    /// event: it only fires while the row really is past due.
    /// </summary>
    private async Task NotifyRenewalFailedAsync(UserSubscription row, CancellationToken ct)
    {
        var decision = SubscriptionAccess.Evaluate(row, DateTime.UtcNow);
        if (row.Status != OnvoSubscriptionStatuses.PastDue || !SubscriptionAccess.IsRenewalExpected(row))
            return;

        var dedupeKey = $"{row.OnvoSubscriptionId}:{row.PaidThroughUtc:yyyyMMdd}";
        var firstTime = await RecordEventAsync(row.UserId, row.UserSubscriptionId, BillingEventTypes.RenewalFailed,
            dedupeKey, $"accessUntil={decision.AccessUntilUtc:O}", ct);
        if (!firstTime)
            return;

        try
        {
            await _push.SendToUserAsync(row.UserId,
                "Payment failed",
                "We could not renew your ArtiCalorias subscription. Open the app to update your payment method.",
                "articalorias-billing");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Billing: renewal-failed push to user {UserId} could not be sent.", row.UserId);
        }
    }

    // ── Account deletion ──────────────────────────────────────────────────────

    public async Task CancelAllForAccountDeletionAsync(long userId, CancellationToken ct = default)
    {
        var rows = await _db.UserSubscriptions
            .Where(s => s.UserId == userId)
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        foreach (var row in rows.Where(r => !OnvoSubscriptionStatuses.IsTerminal(r.Status)))
        {
            if (row.OnvoMode != _onvoSettings.Mode)
            {
                // Test-mode rows move no money. A LIVE row this server cannot
                // reach must not be silently abandoned.
                if (row.OnvoMode == OnvoModes.Live)
                    throw CancelFailed(row, null);
                continue;
            }

            try
            {
                await _onvo.CancelSubscriptionAsync(row.OnvoSubscriptionId, ct);
            }
            catch (OnvoException ex) when (ex.IsNotFound)
            {
                // Already gone.
            }
            catch (OnvoException ex)
            {
                // Only a subscription that would charge again blocks the erase.
                // A plan the user already cancelled, or a checkout nobody ever
                // paid, cannot bill anyone even if this call failed.
                if (SubscriptionAccess.IsRenewalExpected(row))
                    throw CancelFailed(row, ex);

                _logger.LogWarning(ex,
                    "Billing: could not cancel non-renewing subscription {SubscriptionId} during account deletion.",
                    row.OnvoSubscriptionId);
            }

            row.Status = OnvoSubscriptionStatuses.Canceled;
            row.CanceledAtUtc ??= now;
            await SaveRowAsync(row, now, ct);
        }

        _cache.Remove(AccessCacheKey(userId));
    }

    private ApiException CancelFailed(UserSubscription row, Exception? inner)
    {
        _logger.LogError(inner,
            "Billing: could not cancel subscription {SubscriptionId} while deleting user {UserId}; deletion aborted.",
            row.OnvoSubscriptionId, row.UserId);
        return new ApiException(ErrorCodes.SubscriptionCancelFailed,
            "We could not cancel your subscription right now, so your account was NOT deleted and nothing was lost. Please try again in a few minutes.",
            StatusCodes.Status503ServiceUnavailable);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// <summary>The account's subscriptions in the CURRENT ONVO mode, newest first, tracked.</summary>
    private async Task<List<UserSubscription>> LoadRowsAsync(long userId, CancellationToken ct)
    {
        var mode = _onvoSettings.Mode;
        if (mode is null)
            return [];

        return await _db.UserSubscriptions
            .Where(s => s.UserId == userId && s.OnvoMode == mode)
            .OrderByDescending(s => s.UserSubscriptionId)
            .Take(20)
            .ToListAsync(ct);
    }

    private async Task SaveRowAsync(UserSubscription row, DateTime nowUtc, CancellationToken ct)
    {
        row.LastSyncedAtUtc = nowUtc;
        row.UpdatedAtUtc = nowUtc;
        await _db.SaveChangesAsync(ct);
        _cache.Remove(AccessCacheKey(row.UserId));
    }

    /// <summary>
    /// Appends an audit event. With a dedupe key the event is write-once and the
    /// return value says whether THIS call wrote it; the unique index settles
    /// the race the existence check cannot.
    /// </summary>
    private async Task<bool> RecordEventAsync(
        long userId, long? subscriptionRowId, string type, string? dedupeKey, string? detail, CancellationToken ct)
    {
        if (dedupeKey is not null &&
            await _db.BillingEvents.AnyAsync(e => e.EventType == type && e.DedupeKey == dedupeKey, ct))
            return false;

        var entry = new BillingEvent
        {
            UserId = userId,
            UserSubscriptionId = subscriptionRowId,
            EventType = type,
            DedupeKey = dedupeKey,
            Detail = detail is { Length: > 1000 } ? detail[..1000] : detail,
            CreatedAtUtc = DateTime.UtcNow
        };
        _db.BillingEvents.Add(entry);

        try
        {
            await _db.SaveChangesAsync(ct);
            return true;
        }
        catch (DbUpdateException ex)
        {
            _db.Entry(entry).State = EntityState.Detached;
            if (dedupeKey is null)
                _logger.LogError(ex, "Billing: could not record {EventType} for user {UserId}.", type, userId);
            return false;
        }
    }

    private void EnforceRateLimit(string key, int perHour)
    {
        var counter = _cache.GetOrCreate(key, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1);
            return new RateCounter();
        })!;

        if (Interlocked.Increment(ref counter.Count) > perHour)
            throw new ApiException(ErrorCodes.BillingRateLimited,
                "Too many attempts. Please wait a few minutes and try again.",
                StatusCodes.Status429TooManyRequests);
    }

    private sealed class RateCounter
    {
        public int Count;
    }

    private ApiException ProviderUnavailable(OnvoException ex, string action)
    {
        _logger.LogError(ex, "Billing: ONVO call failed ({Status}) while trying to {Action}.", ex.StatusCode, action);
        return new ApiException(ErrorCodes.BillingProviderError,
            $"We could not reach the payment provider to {action}. Please try again in a moment.",
            StatusCodes.Status503ServiceUnavailable);
    }

    private static string AccessCacheKey(long userId) => $"billing-access:{userId}";

    /// <summary>SQL Server hands back Unspecified kinds; the JSON must say "Z" or browsers read it as local time.</summary>
    private static DateTime Utc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);

    private static DateTime? Utc(DateTime? value) => value is { } v ? Utc(v) : null;
}
