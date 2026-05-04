using Articalorias.Configuration;
using Articalorias.Interfaces;
using Microsoft.Extensions.Options;

namespace Articalorias.Services;

public class MealReminderService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly MealReminderSettings _settings;
    private readonly ILogger<MealReminderService> _logger;

    private readonly record struct ReminderSlot(int UtcHour, int UtcMinute, string Title, string Body);

    public MealReminderService(
        IServiceScopeFactory scopeFactory,
        IOptions<MealReminderSettings> settings,
        ILogger<MealReminderService> logger)
    {
        _scopeFactory = scopeFactory;
        _settings = settings.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var slots = new[]
        {
            new ReminderSlot(_settings.LunchUtcHour,  _settings.LunchUtcMinute,
                "🍽️ Log your lunch!",
                "Did you eat? Take a moment to add your midday meal to ArtiCalorias."),

            new ReminderSlot(_settings.DinnerUtcHour, _settings.DinnerUtcMinute,
                "🌙 Log your dinner!",
                "End your day strong — add your dinner and any evening activities."),
        };

        while (!stoppingToken.IsCancellationRequested)
        {
            var now = DateTime.UtcNow;

            // Find the slot whose next fire time is soonest
            var (delay, slot) = slots
                .Select(s => (delay: NextOccurrence(now, s.UtcHour, s.UtcMinute) - now, slot: s))
                .MinBy(x => x.delay);

            _logger.LogInformation(
                "MealReminderService: next notification '{Title}' fires in {Delay:hh\\:mm\\:ss} (UTC {Hour:D2}:{Minute:D2})",
                slot.Title, delay, slot.UtcHour, slot.UtcMinute);

            try
            {
                await Task.Delay(delay, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            await SendReminderAsync(slot, stoppingToken);
        }
    }

    private async Task SendReminderAsync(ReminderSlot slot, CancellationToken ct)
    {
        try
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var push = scope.ServiceProvider.GetRequiredService<IPushNotificationService>();
            await push.SendToAllSubscribersAsync(slot.Title, slot.Body);

            _logger.LogInformation("MealReminderService: sent '{Title}' notification.", slot.Title);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            _logger.LogError(ex, "MealReminderService: failed to send '{Title}' notification.", slot.Title);
        }
    }

    /// <summary>Returns the next UTC DateTime at which the given hour:minute occurs.</summary>
    private static DateTime NextOccurrence(DateTime utcNow, int hour, int minute)
    {
        var candidate = utcNow.Date.AddHours(hour).AddMinutes(minute);
        if (candidate <= utcNow)
            candidate = candidate.AddDays(1);
        return candidate;
    }
}
