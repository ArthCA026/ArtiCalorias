using Articalorias.Data;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Services;

/// <summary>
/// Background service that fires per-user meal reminders every minute.
/// Each minute it queries NotificationSchedules for rows matching the current UTC hour and minute,
/// then sends a push notification to each matching user's subscribed devices.
///
/// An in-memory cache of active (HourUtc, MinuteUtc) pairs is maintained and refreshed every
/// <see cref="CacheRefreshInterval"/> so the full per-user query is skipped on minutes where
/// no enabled schedules could match.
/// </summary>
public class MealReminderService : BackgroundService
{
    private static readonly TimeSpan CacheRefreshInterval = TimeSpan.FromMinutes(5);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MealReminderService> _logger;

    // Distinct (HourUtc, MinuteUtc) pairs across all enabled schedules. Null = never loaded.
    private HashSet<(int Hour, int Minute)>? _activeMinutes;
    private DateTime _cacheRefreshedAtUtc = DateTime.MinValue;

    public MealReminderService(IServiceScopeFactory scopeFactory, ILogger<MealReminderService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("MealReminderService started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.UtcNow;

            // Sleep until the top of the next minute (minus a small buffer to avoid drift)
            var msUntilNextMinute = (60 - now.Second) * 1000 - now.Millisecond;
            if (msUntilNextMinute < 100) msUntilNextMinute += 60_000; // safety margin

            try
            {
                await Task.Delay(msUntilNextMinute, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            var tick = DateTime.UtcNow;

            // Refresh the active-minutes cache when stale (first run or every CacheRefreshInterval).
            if (_activeMinutes is null || tick - _cacheRefreshedAtUtc >= CacheRefreshInterval)
                await RefreshActiveMinutesCacheAsync(stoppingToken);

            // Skip the per-user DB query entirely when no enabled schedule targets this minute.
            if (_activeMinutes is not null && !_activeMinutes.Contains((tick.Hour, tick.Minute)))
                continue;

            await FireDueRemindersAsync(tick, stoppingToken);
        }

        _logger.LogInformation("MealReminderService stopped.");
    }

    private async Task RefreshActiveMinutesCacheAsync(CancellationToken ct)
    {
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var pairs = await db.NotificationSchedules
                .Where(s => s.Enabled)
                .Select(s => new { s.HourUtc, s.MinuteUtc })
                .Distinct()
                .ToListAsync(ct);

            _activeMinutes = pairs.Select(p => (p.HourUtc, p.MinuteUtc)).ToHashSet();
            _cacheRefreshedAtUtc = DateTime.UtcNow;

            _logger.LogDebug(
                "MealReminderService: active-minutes cache refreshed — {Count} distinct slot(s).",
                _activeMinutes.Count);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            _logger.LogError(ex, "MealReminderService: failed to refresh active-minutes cache.");
            // Retain the stale cache (or null) so the next tick retries the refresh.
        }
    }

    private async Task FireDueRemindersAsync(DateTime utcNow, CancellationToken ct)
    {
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var push = scope.ServiceProvider.GetRequiredService<IPushNotificationService>();

            var dueSchedules = await db.NotificationSchedules
                .Where(s => s.Enabled
                         && s.HourUtc == utcNow.Hour
                         && s.MinuteUtc == utcNow.Minute)
                .ToListAsync(ct);

            if (dueSchedules.Count == 0) return;

            _logger.LogInformation(
                "MealReminderService: firing {Count} reminder(s) at UTC {Hour:D2}:{Minute:D2}",
                dueSchedules.Count, utcNow.Hour, utcNow.Minute);

            foreach (var schedule in dueSchedules)
            {
                var (title, body, tag) = schedule.Type switch
                {
                    ReminderType.Breakfast => (
                        "🌅 Log your breakfast!",
                        "Start your day right — add your morning meal to ArtiCalorias.",
                        "articalorias-breakfast"),
                    ReminderType.Lunch => (
                        "🍽️ Log your lunch!",
                        "Did you eat? Take a moment to add your midday meal.",
                        "articalorias-lunch"),
                    ReminderType.Dinner => (
                        "🌙 Log your dinner!",
                        "End your day strong — add your dinner and any activities.",
                        "articalorias-dinner"),
                    _ => (
                        "ArtiCalorias reminder",
                        "Time to log your meal!",
                        "articalorias-reminder"),
                };

                try
                {
                    await push.SendToUserAsync(schedule.UserId, title, body, tag);
                    _logger.LogDebug(
                        "MealReminderService: sent {Type} reminder to user {UserId}",
                        schedule.Type, schedule.UserId);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "MealReminderService: failed to send {Type} reminder to user {UserId}",
                        schedule.Type, schedule.UserId);
                }
            }
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            _logger.LogError(ex,
                "MealReminderService: error during reminder check at UTC {Hour:D2}:{Minute:D2}",
                utcNow.Hour, utcNow.Minute);
        }
    }
}

