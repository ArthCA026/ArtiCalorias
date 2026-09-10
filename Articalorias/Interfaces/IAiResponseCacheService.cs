namespace Articalorias.Interfaces;

/// <summary>
/// Two-level cache (in-memory + database) for AI parsing responses.
/// Cache failures must never break parsing — implementations degrade to
/// "no cache" and let the OpenAI call proceed.
/// </summary>
public interface IAiResponseCacheService
{
    /// <summary>Returns the cached raw response JSON, or null on miss/expiry.</summary>
    Task<string?> GetAsync(string cacheType, string cacheKeyHash);

    /// <summary>Stores a raw response. Null TTL means the entry never expires.</summary>
    Task SetAsync(string cacheType, string cacheKeyHash, string responseJson, TimeSpan? ttl);
}
