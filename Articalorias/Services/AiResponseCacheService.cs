using Articalorias.Data;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace Articalorias.Services;

/// <summary>
/// L1 = process memory (fast path for hot inputs), L2 = database (durable,
/// shared across restarts and instances). Every DB error is swallowed with a
/// warning: a broken cache must cost one extra OpenAI call, never an outage.
/// </summary>
public class AiResponseCacheService : IAiResponseCacheService
{
    /// <summary>L1 lifetime; short because L2 is the source of truth.</summary>
    private static readonly TimeSpan MemoryTtl = TimeSpan.FromMinutes(15);

    private readonly AppDbContext _db;
    private readonly IMemoryCache _memoryCache;
    private readonly ILogger<AiResponseCacheService> _logger;

    public AiResponseCacheService(
        AppDbContext db,
        IMemoryCache memoryCache,
        ILogger<AiResponseCacheService> logger)
    {
        _db = db;
        _memoryCache = memoryCache;
        _logger = logger;
    }

    public async Task<string?> GetAsync(string cacheType, string cacheKeyHash)
    {
        var memoryKey = MemoryKey(cacheKeyHash);
        if (_memoryCache.TryGetValue(memoryKey, out string? cached) && cached is not null)
            return cached;

        try
        {
            var now = DateTime.UtcNow;
            var entry = await _db.AiResponseCache
                .FirstOrDefaultAsync(e => e.CacheKeyHash == cacheKeyHash);

            if (entry is null || (entry.ExpiresAtUtc.HasValue && entry.ExpiresAtUtc.Value <= now))
                return null;

            // Hit telemetry: which entries earn their keep, and a LastHitAtUtc
            // signal for any future cleanup of never-used rows. Racy undercount
            // under concurrency is fine.
            entry.HitCount++;
            entry.LastHitAtUtc = now;
            await _db.SaveChangesAsync();

            _memoryCache.Set(memoryKey, entry.ResponseJson, MemoryTtl);
            return entry.ResponseJson;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AI cache read failed for type {CacheType}; parsing continues uncached", cacheType);
            return null;
        }
    }

    public async Task SetAsync(string cacheType, string cacheKeyHash, string responseJson, TimeSpan? ttl)
    {
        _memoryCache.Set(MemoryKey(cacheKeyHash), responseJson, MemoryTtl);

        try
        {
            var now = DateTime.UtcNow;
            var expiresAtUtc = ttl.HasValue ? now.Add(ttl.Value) : (DateTime?)null;

            var existing = await _db.AiResponseCache
                .FirstOrDefaultAsync(e => e.CacheKeyHash == cacheKeyHash);

            if (existing is null)
            {
                _db.AiResponseCache.Add(new AiResponseCacheEntry
                {
                    CacheKeyHash = cacheKeyHash,
                    CacheType = cacheType,
                    ResponseJson = responseJson,
                    CreatedAtUtc = now,
                    ExpiresAtUtc = expiresAtUtc,
                    HitCount = 0,
                    LastHitAtUtc = now
                });
            }
            else
            {
                // Refresh an expired (or concurrently re-parsed) entry in place.
                existing.CacheType = cacheType;
                existing.ResponseJson = responseJson;
                existing.CreatedAtUtc = now;
                existing.ExpiresAtUtc = expiresAtUtc;
                existing.LastHitAtUtc = now;
            }

            await _db.SaveChangesAsync();

            // Opportunistic cleanup on the miss path only — it already paid for
            // a multi-second OpenAI call, so one indexed DELETE is free noise.
            await _db.AiResponseCache
                .Where(e => e.ExpiresAtUtc != null && e.ExpiresAtUtc < now)
                .ExecuteDeleteAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "AI cache write failed for type {CacheType}; response served uncached", cacheType);
        }
    }

    private static string MemoryKey(string cacheKeyHash) => $"aicache:{cacheKeyHash}";
}
