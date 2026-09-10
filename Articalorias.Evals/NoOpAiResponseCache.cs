using Articalorias.Interfaces;

namespace Articalorias.Evals;

/// <summary>Evals must measure the live model — never a cached answer.</summary>
public class NoOpAiResponseCache : IAiResponseCacheService
{
    public Task<string?> GetAsync(string cacheType, string cacheKeyHash)
        => Task.FromResult<string?>(null);

    public Task SetAsync(string cacheType, string cacheKeyHash, string responseJson, TimeSpan? ttl)
        => Task.CompletedTask;
}
