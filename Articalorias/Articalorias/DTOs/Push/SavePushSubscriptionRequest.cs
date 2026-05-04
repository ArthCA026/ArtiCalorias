namespace Articalorias.DTOs.Push;

public class SavePushSubscriptionRequest
{
    public string Endpoint { get; set; } = string.Empty;
    public string P256DH { get; set; } = string.Empty;
    public string Auth { get; set; } = string.Empty;
}
