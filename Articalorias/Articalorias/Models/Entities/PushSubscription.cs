namespace Articalorias.Models.Entities;

public class PushSubscription
{
    public long PushSubscriptionId { get; set; }
    public long UserId { get; set; }
    public string Endpoint { get; set; } = string.Empty;
    public string P256DH { get; set; } = string.Empty;
    public string Auth { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }

    // Navigation
    public User User { get; set; } = null!;
}
