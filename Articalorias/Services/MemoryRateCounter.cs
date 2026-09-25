using Microsoft.Extensions.Caching.Memory;

namespace Articalorias.Services;

/// <summary>
/// Fixed-window counters in process memory, shared by the AI quota filter and
/// the auth throttles. A restart resets them (errs in the user's favour) and
/// they are exact only while the API runs on a single instance: moving them
/// to SQL or Redis is the change to make if it ever scales out.
/// </summary>
public class MemoryRateCounter
{
    private readonly IMemoryCache _cache;

    public MemoryRateCounter(IMemoryCache cache)
    {
        _cache = cache;
    }

    private sealed class Counter
    {
        public int Count;
        public DateTime WindowEndsUtc;
    }

    /// <summary>Counts one hit and reports whether the window still has room.</summary>
    public bool TryConsume(string key, int limit, TimeSpan window, out TimeSpan retryAfter)
    {
        var counter = GetOrCreate(key, window);
        var count = Interlocked.Increment(ref counter.Count);
        if (count <= limit)
        {
            retryAfter = TimeSpan.Zero;
            return true;
        }

        retryAfter = RemainingWindow(counter);
        return false;
    }

    /// <summary>Records a hit without evaluating the limit (e.g. a failed login).</summary>
    public void Record(string key, TimeSpan window)
    {
        var counter = GetOrCreate(key, window);
        Interlocked.Increment(ref counter.Count);
    }

    /// <summary>True when the key already reached <paramref name="limit"/> hits in its window.</summary>
    public bool IsExhausted(string key, int limit, out TimeSpan retryAfter)
    {
        if (_cache.TryGetValue(key, out Counter? counter) && counter is not null && counter.Count >= limit)
        {
            retryAfter = RemainingWindow(counter);
            return true;
        }

        retryAfter = TimeSpan.Zero;
        return false;
    }

    public void Reset(string key) => _cache.Remove(key);

    private Counter GetOrCreate(string key, TimeSpan window)
        => _cache.GetOrCreate(key, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = window;
            return new Counter { WindowEndsUtc = DateTime.UtcNow.Add(window) };
        })!;

    private static TimeSpan RemainingWindow(Counter counter)
    {
        var remaining = counter.WindowEndsUtc - DateTime.UtcNow;
        return remaining < TimeSpan.Zero ? TimeSpan.Zero : remaining;
    }
}
