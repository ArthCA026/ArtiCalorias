using Articalorias.Data;
using Articalorias.DTOs.Streaks;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Services;

public class StreakService : IStreakService
{
    private const int LookbackDays = 400;

    private readonly AppDbContext _db;

    public StreakService(AppDbContext db)
    {
        _db = db;
    }

    // ── Public API ────────────────────────────────────────────────────────

    public async Task<StreakDto> GetOrCreateAsync(long userId, CancellationToken ct = default)
    {
        var streak = await GetOrCreateRowAsync(userId, ct);
        var today = await GetUserLocalTodayAsync(userId, ct);

        var currentStreak = streak.CurrentStreak;

        // Staleness check: if the last qualifying date is more than one day old,
        // the streak has been broken. Return 0 without persisting to avoid a write
        // on every read.
        if (streak.LastLoggedDate.HasValue && streak.LastLoggedDate.Value < today.AddDays(-1))
            currentStreak = 0;

        return ToDto(streak, currentStreak);
    }

    public async Task RecalculateForUserAsync(long userId, CancellationToken ct = default)
    {
        var streak = await GetOrCreateRowAsync(userId, ct);

        if (!streak.StreakEnabled)
            return;

        var today = await GetUserLocalTodayAsync(userId, ct);
        await RecalculateAndSaveAsync(streak, today, ct);
    }

    public async Task<StreakDto> UpdateSettingsAsync(long userId, bool enabled, CancellationToken ct = default)
    {
        var streak = await GetOrCreateRowAsync(userId, ct);
        streak.StreakEnabled = enabled;
        streak.UpdatedAtUtc = DateTime.UtcNow;

        if (enabled)
        {
            // Recalculate when re-enabling so the counter is immediately accurate.
            var today = await GetUserLocalTodayAsync(userId, ct);
            await RecalculateAndSaveAsync(streak, today, ct);
        }
        else
        {
            await _db.SaveChangesAsync(ct);
        }

        return ToDto(streak, streak.CurrentStreak);
    }

    public async Task<StreakDto> ResetAsync(long userId, CancellationToken ct = default)
    {
        var streak = await GetOrCreateRowAsync(userId, ct);
        streak.CurrentStreak = 0;
        streak.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);

        return ToDto(streak, 0);
    }

    // ── Private helpers ───────────────────────────────────────────────────

    /// <summary>
    /// Computes the streak from the food log history and persists the result.
    /// </summary>
    private async Task RecalculateAndSaveAsync(UserStreak streak, DateOnly today, CancellationToken ct)
    {
        var cutoff = today.AddDays(-LookbackDays);

        // Qualifying dates: DailyLogs that have at least one FoodEntry,
        // within the bounded lookback window, ordered newest first.
        var qualifiedDates = await _db.DailyLogs
            .AsNoTracking()
            .Where(dl => dl.UserId == streak.UserId
                      && dl.LogDate >= cutoff
                      && dl.FoodEntries.Count > 0)
            .OrderByDescending(dl => dl.LogDate)
            .Select(dl => dl.LogDate)
            .ToListAsync(ct);

        var current = 0;
        var cursor = today;

        foreach (var date in qualifiedDates)
        {
            // Accept 'today' or 'yesterday' as the starting point (streak hasn't broken yet
            // if the user simply hasn't logged today).
            if (current == 0 && (date == today || date == today.AddDays(-1)))
            {
                current++;
                cursor = date.AddDays(-1);
            }
            else if (date == cursor)
            {
                current++;
                cursor = date.AddDays(-1);
            }
            else
            {
                break; // Gap found — no earlier date can contribute.
            }
        }

        var longest = Math.Max(streak.LongestStreak, current);
        var lastDate = qualifiedDates.Count > 0 ? qualifiedDates[0] : (DateOnly?)null;

        streak.CurrentStreak = current;
        streak.LongestStreak = longest;
        streak.LastLoggedDate = lastDate;
        streak.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Retrieves or creates the UserStreak row for the given user.
    /// The row is tracked for subsequent SaveChanges calls.
    /// </summary>
    private async Task<UserStreak> GetOrCreateRowAsync(long userId, CancellationToken ct)
    {
        var streak = await _db.UserStreaks.FirstOrDefaultAsync(s => s.UserId == userId, ct);

        if (streak is null)
        {
            streak = new UserStreak
            {
                UserId = userId,
                StreakEnabled = true,
                CurrentStreak = 0,
                LongestStreak = 0,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow,
            };
            _db.UserStreaks.Add(streak);
            await _db.SaveChangesAsync(ct);
        }

        return streak;
    }

    /// <summary>
    /// Resolves "today" in the user's local timezone.
    /// Reads TimeZoneId from the user's profile; falls back to UTC if absent or unrecognised.
    /// </summary>
    private async Task<DateOnly> GetUserLocalTodayAsync(long userId, CancellationToken ct)
    {
        var timeZoneId = await _db.UserProfiles
            .AsNoTracking()
            .Where(p => p.UserId == userId)
            .Select(p => p.TimeZoneId)
            .FirstOrDefaultAsync(ct);

        TimeZoneInfo tz;
        try
        {
            tz = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId ?? "UTC");
        }
        catch (TimeZoneNotFoundException)
        {
            tz = TimeZoneInfo.Utc;
        }
        catch (InvalidTimeZoneException)
        {
            tz = TimeZoneInfo.Utc;
        }

        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz));
    }

    private static StreakDto ToDto(UserStreak streak, int reportedCurrentStreak) => new()
    {
        StreakEnabled = streak.StreakEnabled,
        CurrentStreak = reportedCurrentStreak,
        LongestStreak = streak.LongestStreak,
        LastLoggedDate = streak.LastLoggedDate,
    };
}
