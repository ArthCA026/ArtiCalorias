namespace Articalorias.Interfaces;

public interface IPushNotificationService
{
    Task SubscribeAsync(long userId, string endpoint, string p256dh, string auth);
    Task UnsubscribeAsync(long userId, string endpoint);
    Task SendToUserAsync(long userId, string title, string body);
    Task SendToAllSubscribersAsync(string title, string body);
    string GetVapidPublicKey();
}
