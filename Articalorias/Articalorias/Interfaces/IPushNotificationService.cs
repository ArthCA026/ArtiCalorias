using Articalorias.DTOs.Push;

namespace Articalorias.Interfaces;

public interface IPushNotificationService
{
    Task SubscribeAsync(long userId, string endpoint, string p256dh, string auth);
    Task UnsubscribeAsync(long userId, string endpoint);
    Task SendToUserAsync(long userId, string title, string body, string? tag = null);
    Task SendToAllSubscribersAsync(string title, string body);
    string GetVapidPublicKey();
    Task<List<NotificationScheduleDto>> GetSchedulesAsync(long userId);
    Task UpsertSchedulesAsync(long userId, List<NotificationScheduleDto> schedules);
}
