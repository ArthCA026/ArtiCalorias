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

            // One profile fetch for the whole batch; each user's daily log is read
            // for their own local "today" (their timezone), never created.
            var dueUserIds = dueSchedules.Select(s => s.UserId).Distinct().ToList();
            var profiles = await db.UserProfiles
                .AsNoTracking()
                .Where(p => dueUserIds.Contains(p.UserId))
                .Select(p => new { p.UserId, p.TimeZoneId, p.DailyBaseGoalKcal, p.CalorieDisplayMode })
                .ToDictionaryAsync(p => p.UserId, ct);

            foreach (var schedule in dueSchedules)
            {
                var tag = $"articalorias-{schedule.Type.ToString().ToLowerInvariant()}";
                string title;
                string body;

                profiles.TryGetValue(schedule.UserId, out var profile);
                var localToday = ResolveLocalToday(profile?.TimeZoneId, utcNow);

                var log = await db.DailyLogs
                    .AsNoTracking()
                    .Where(d => d.UserId == schedule.UserId && d.LogDate == localToday)
                    .Select(d => new
                    {
                        d.TotalFoodCaloriesKcal,
                        d.TotalDailyExpenditureKcal,
                        d.CaloriesRemainingToDailyTargetKcal,
                        d.SuggestedDailyAverageRemainingKcal,
                        d.SnapshotDailyBaseGoalKcal,
                        d.IsFastingDay,
                        HasBudget = d.SnapshotWeightKg != null && d.SnapshotHeightCm != null,
                    })
                    .FirstOrDefaultAsync(ct);

                // A deliberate fasting day gets no meal nudges: reminding
                // someone to log lunch on a day they chose not to eat is noise.
                // Reminders resume automatically the next day.
                if (log is not null && log.IsFastingDay)
                    continue;

                if (log is not null && log.HasBudget)
                {
                    // Same budget the Today ring shows, under the user's own display mode.
                    var budget = (profile?.CalorieDisplayMode ?? "adjusted") switch
                    {
                        "net" => log.TotalDailyExpenditureKcal,
                        "goal" => log.TotalFoodCaloriesKcal + log.CaloriesRemainingToDailyTargetKcal,
                        _ => log.TotalDailyExpenditureKcal + log.SuggestedDailyAverageRemainingKcal,
                    };
                    budget = Math.Max(budget, 1m);
                    var remaining = (int)Math.Round(budget - log.TotalFoodCaloriesKcal);
                    var surplusGoal = log.SnapshotDailyBaseGoalKcal > 0m;
                    (title, body) = BuildPersonalizedContent(schedule.Type, remaining, surplusGoal);
                }
                else
                {
                    // No day started or no body metrics: still short, still meal-specific.
                    var meal = MealName(schedule.Type);
                    title = $"Time for {meal}";
                    body = "Log it in ArtiCalorias and keep your streak alive.";
                }

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

    // ── Personalized copy ────────────────────────────────────────────────────
    //
    // Short on purpose: the number is the hook. The wording flips with the goal
    // direction (deficit vs surplus) and with whether the day's target is already
    // passed, and it never guilts the user (a passed budget still asks for a log).

    private static (string Title, string Body) BuildPersonalizedContent(
        ReminderType type, int remainingKcal, bool surplusGoal)
    {
        var meal = MealName(type);
        var n = Math.Abs(remainingKcal).ToString("N0");

        if (surplusGoal)
        {
            return remainingKcal > 0
                ? ($"{n} kcal still to eat today", $"Fuel your surplus: log your {meal} once it is down.")
                : ("Surplus target reached", $"Well fueled. Log your {meal} to keep the record straight.");
        }

        return remainingKcal > 0
            ? ($"{n} kcal left today", $"Room for a good {meal}. Log it once you eat.")
            : ("Daily budget reached", $"Still log your {meal}: tomorrow rebalances automatically.");
    }

    private static string MealName(ReminderType type) => type switch
    {
        ReminderType.Breakfast => "breakfast",
        ReminderType.Lunch => "lunch",
        ReminderType.Dinner => "dinner",
        _ => "meal",
    };

    /// <summary>User's local calendar date; UTC when the timezone is missing or unknown.</summary>
    private static DateOnly ResolveLocalToday(string? timeZoneId, DateTime utcNow)
    {
        TimeZoneInfo tz;
        try { tz = TimeZoneInfo.FindSystemTimeZoneById(timeZoneId ?? "UTC"); }
        catch (TimeZoneNotFoundException) { tz = TimeZoneInfo.Utc; }
        catch (InvalidTimeZoneException) { tz = TimeZoneInfo.Utc; }
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(utcNow, tz));
    }
}

