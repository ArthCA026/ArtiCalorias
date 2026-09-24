using Articalorias.Services.Billing;

namespace Articalorias.Interfaces;

/// <summary>
/// Server-side ONVO Pay REST client. Every call authenticates with the secret
/// key; failures surface as <see cref="OnvoException"/>.
/// </summary>
public interface IOnvoClient
{
    Task<OnvoProduct> CreateProductAsync(string name, string description, CancellationToken ct = default);

    Task<OnvoPrice> CreateRecurringPriceAsync(
        string productId, int unitAmountCents, string currency, string interval, string nickname,
        CancellationToken ct = default);

    Task<OnvoCustomer> CreateCustomerAsync(string name, string email, CancellationToken ct = default);

    /// <summary>
    /// Creates the recurring charge with paymentBehavior "allow_incomplete": no
    /// payment method yet, nothing is charged. ONVO's browser SDK collects the
    /// card and confirms it, so card data never reaches this API.
    /// </summary>
    Task<OnvoSubscription> CreateIncompleteSubscriptionAsync(
        string customerId, string priceId, string description, IReadOnlyDictionary<string, string> metadata,
        CancellationToken ct = default);

    Task<OnvoSubscription> GetSubscriptionAsync(string subscriptionId, CancellationToken ct = default);

    Task<OnvoSubscription> SetCancelAtPeriodEndAsync(
        string subscriptionId, bool cancelAtPeriodEnd, CancellationToken ct = default);

    /// <summary>Cancels immediately: ONVO stops charging from this moment.</summary>
    Task<OnvoSubscription> CancelSubscriptionAsync(string subscriptionId, CancellationToken ct = default);

    Task<OnvoPaymentIntent> GetPaymentIntentAsync(string paymentIntentId, CancellationToken ct = default);
}
