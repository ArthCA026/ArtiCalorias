using Articalorias.DTOs.Consent;

namespace Articalorias.Interfaces;

public interface IConsentService
{
    /// <summary>Latest state per consent type plus the full audit trail.</summary>
    Task<ConsentStateResponse> GetStateAsync(long userId, CancellationToken ct = default);

    /// <summary>Appends grant/revocation rows and returns the fresh state.</summary>
    Task<ConsentStateResponse> RecordAsync(long userId, RecordConsentRequest request, CancellationToken ct = default);

    /// <summary>Whether the user holds a health_data grant at the current policy
    /// version. Cached briefly; used by the write-blocking middleware.</summary>
    Task<bool> HasCurrentHealthGrantAsync(long userId, CancellationToken ct = default);
}
