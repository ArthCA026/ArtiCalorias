namespace Articalorias.Models.Entities;

/// <summary>
/// One cached AI parsing response, shared across all users. The key is a
/// SHA-256 hash of the normalized input plus everything that shapes the answer
/// (prompt version, model, country, tracked-macro options) — the raw input
/// text is deliberately never stored, and no row links to any user (Ley 8968:
/// meal/activity text is health data only while tied to a person).
/// </summary>
public class AiResponseCacheEntry
{
    /// <summary>SHA-256 of the cache key material, lowercase hex.</summary>
    public string CacheKeyHash { get; set; } = string.Empty;

    /// <summary>'food' | 'activity' | 'met' | 'combined'.</summary>
    public string CacheType { get; set; } = string.Empty;

    /// <summary>Raw model response JSON; re-validated on every read.</summary>
    public string ResponseJson { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; }

    /// <summary>NULL = never expires (MET estimates are deterministic).</summary>
    public DateTime? ExpiresAtUtc { get; set; }

    public long HitCount { get; set; }

    public DateTime LastHitAtUtc { get; set; }
}
