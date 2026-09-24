using Articalorias.DTOs.Billing;

namespace Articalorias.Interfaces;

public interface IBillingService
{
    /// <summary>
    /// The gate: may this account use the app right now? Local and cached, it
    /// never calls ONVO, so it is safe on every request.
    /// </summary>
    Task<bool> HasAccessAsync(long userId, CancellationToken ct = default);

    /// <summary>
    /// Access plus everything the subscription screens draw. Refreshes from
    /// ONVO when the local copy is due (a renewal date passed, a day went by),
    /// which is what heals a missed webhook the moment the user opens the app.
    /// </summary>
    Task<BillingStatusResponse> GetStatusAsync(long userId, CancellationToken ct = default);

    /// <summary>Creates (or reuses) the unpaid ONVO subscription the browser SDK will collect a card for.</summary>
    Task<StartCheckoutResponse> StartCheckoutAsync(long userId, StartCheckoutRequest request, CancellationToken ct = default);

    /// <summary>Re-reads the account's open subscriptions from ONVO on demand (after paying, "refresh status").</summary>
    Task<BillingStatusResponse> SyncAsync(long userId, CancellationToken ct = default);

    /// <summary>Stops the renewal. The paid period stays usable to its end.</summary>
    Task<BillingStatusResponse> CancelAsync(long userId, CancellationToken ct = default);

    /// <summary>Undoes a cancellation that has not taken effect yet.</summary>
    Task<BillingStatusResponse> ResumeAsync(long userId, CancellationToken ct = default);

    /// <summary>
    /// A verified ONVO webhook said something happened to a subscription or a
    /// customer. Nothing else from the event is used: the subscription is
    /// re-read from ONVO. Returns false when the event is not about one of ours.
    /// </summary>
    Task<bool> HandleProviderEventAsync(string eventType, string? subscriptionId, string? customerId, CancellationToken ct = default);

    /// <summary>
    /// Account deletion: every subscription that could still charge is cancelled
    /// at ONVO NOW. Throws when ONVO cannot confirm, so an account is never
    /// erased while its card keeps being billed.
    /// </summary>
    Task CancelAllForAccountDeletionAsync(long userId, CancellationToken ct = default);
}
