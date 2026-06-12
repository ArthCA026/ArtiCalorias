using System.Text.Json;
using Articalorias.Configuration;
using Articalorias.Data;
using Articalorias.DTOs.Push;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WebPush;
using PushSubscriptionEntity = Articalorias.Models.Entities.PushSubscription;

namespace Articalorias.Services;

public class PushNotificationService : IPushNotificationService
{
    private readonly AppDbContext _db;
    private readonly VapidSettings _vapid;
    private readonly MealReminderSettings _reminderDefaults;
    private readonly WebPushClient _client;

    public PushNotificationService(
        AppDbContext db,
        IOptions<VapidSettings> vapidOptions,
        IOptions<MealReminderSettings> reminderOptions)
    {
        _db = db;
        _vapid = vapidOptions.Value;
        _reminderDefaults = reminderOptions.Value;
        _client = new WebPushClient();
    }

    public string GetVapidPublicKey() => _vapid.PublicKey;

    public async Task SubscribeAsync(long userId, string endpoint, string p256dh, string auth)
    {
        var existing = await _db.PushSubscriptions.FirstOrDefaultAsync(s => s.Endpoint == endpoint);

        if (existing is not null)
        {
            existing.UserId = userId;
            existing.P256DH = p256dh;
            existing.Auth = auth;
        }
        else
        {
            _db.PushSubscriptions.Add(new PushSubscriptionEntity
            {
                UserId = userId,
                Endpoint = endpoint,
                P256DH = p256dh,
                Auth = auth,
                CreatedAtUtc = DateTime.UtcNow,
            });
        }

        await _db.SaveChangesAsync();
    }

    public async Task UnsubscribeAsync(long userId, string endpoint)
    {
        var sub = await _db.PushSubscriptions
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Endpoint == endpoint);

        if (sub is not null)
        {
            _db.PushSubscriptions.Remove(sub);
            await _db.SaveChangesAsync();
        }
    }

    public async Task SendToUserAsync(long userId, string title, string body, string? tag = null)
    {
        var subscriptions = await _db.PushSubscriptions
            .Where(s => s.UserId == userId)
            .ToListAsync();

        var payload = JsonSerializer.Serialize(new
        {
            title,
            body,
            tag = tag ?? "articalorias-reminder",
            url = "/",
        });
        var vapidDetails = new VapidDetails(_vapid.Subject, _vapid.PublicKey, _vapid.PrivateKey);

        var stale = new List<PushSubscriptionEntity>();

        foreach (var sub in subscriptions)
        {
            try
            {
                var pushSub = new WebPush.PushSubscription(sub.Endpoint, sub.P256DH, sub.Auth);
                await _client.SendNotificationAsync(pushSub, payload, vapidDetails);
            }
            catch (WebPushException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Gone)
            {
                stale.Add(sub);
            }
        }

        if (stale.Count > 0)
        {
            _db.PushSubscriptions.RemoveRange(stale);
            await _db.SaveChangesAsync();
        }
    }

    public async Task SendToAllSubscribersAsync(string title, string body)
    {
        var subscriptions = await _db.PushSubscriptions.ToListAsync();
        if (subscriptions.Count == 0) return;

        var payload = JsonSerializer.Serialize(new
        {
            title,
            body,
            tag = "articalorias-reminder",
            url = "/",
        });
        var vapidDetails = new VapidDetails(_vapid.Subject, _vapid.PublicKey, _vapid.PrivateKey);

        var stale = new List<PushSubscriptionEntity>();

        foreach (var sub in subscriptions)
        {
            try
            {
                var pushSub = new WebPush.PushSubscription(sub.Endpoint, sub.P256DH, sub.Auth);
                await _client.SendNotificationAsync(pushSub, payload, vapidDetails);
            }
            catch (WebPushException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Gone)
            {
                stale.Add(sub);
            }
        }

        if (stale.Count > 0)
        {
            _db.PushSubscriptions.RemoveRange(stale);
            await _db.SaveChangesAsync();
        }
    }

    public async Task<List<NotificationScheduleDto>> GetSchedulesAsync(long userId)
    {
        var rows = await _db.NotificationSchedules
            .Where(s => s.UserId == userId)
            .OrderBy(s => s.Type)
            .ToListAsync();

        // First-time user: return defaults (disabled) so the frontend shows something sensible
        if (rows.Count == 0)
        {
            return
            [
                new NotificationScheduleDto("breakfast", false, 13, 0),
                new NotificationScheduleDto("lunch",     false, _reminderDefaults.LunchUtcHour,  _reminderDefaults.LunchUtcMinute),
                new NotificationScheduleDto("dinner",    false, _reminderDefaults.DinnerUtcHour, _reminderDefaults.DinnerUtcMinute),
            ];
        }

        return rows.Select(r => new NotificationScheduleDto(
            r.Type.ToString().ToLower(),
            r.Enabled,
            r.HourUtc,
            r.MinuteUtc
        )).ToList();
    }

    public async Task UpsertSchedulesAsync(long userId, List<NotificationScheduleDto> schedules)
    {
        foreach (var dto in schedules)
        {
            if (!Enum.TryParse<ReminderType>(dto.Type, ignoreCase: true, out var type)) continue;

            var existing = await _db.NotificationSchedules
                .FirstOrDefaultAsync(s => s.UserId == userId && s.Type == type);

            if (existing is not null)
            {
                existing.Enabled = dto.Enabled;
                existing.HourUtc = dto.HourUtc;
                existing.MinuteUtc = dto.MinuteUtc;
                existing.UpdatedAtUtc = DateTime.UtcNow;
            }
            else
            {
                _db.NotificationSchedules.Add(new NotificationSchedule
                {
                    UserId = userId,
                    Type = type,
                    Enabled = dto.Enabled,
                    HourUtc = dto.HourUtc,
                    MinuteUtc = dto.MinuteUtc,
                    UpdatedAtUtc = DateTime.UtcNow,
                });
            }
        }

        await _db.SaveChangesAsync();
    }
}

