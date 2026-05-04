using System.Text.Json;
using Articalorias.Configuration;
using Articalorias.Data;
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
    private readonly WebPushClient _client;

    public PushNotificationService(AppDbContext db, IOptions<VapidSettings> vapidOptions)
    {
        _db = db;
        _vapid = vapidOptions.Value;
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

    public async Task SendToUserAsync(long userId, string title, string body)
    {
        var subscriptions = await _db.PushSubscriptions
            .Where(s => s.UserId == userId)
            .ToListAsync();

        var payload = JsonSerializer.Serialize(new { title, body });
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

        var payload = JsonSerializer.Serialize(new { title, body });
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
}
