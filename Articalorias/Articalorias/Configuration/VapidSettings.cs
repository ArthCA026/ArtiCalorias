namespace Articalorias.Configuration;

public class VapidSettings
{
    public const string SectionName = "Vapid";

    public string Subject { get; set; } = string.Empty;
    public string PublicKey { get; set; } = string.Empty;
    public string PrivateKey { get; set; } = string.Empty;

    /// <summary>
    /// Host suffixes a push endpoint may point at. The server POSTs to every
    /// stored endpoint from inside Azure, so an unrestricted value would be a
    /// server-side request forgery primitive. Override in configuration if a
    /// browser vendor adds a push service.
    /// </summary>
    public string[] AllowedEndpointHostSuffixes { get; set; } =
    [
        "fcm.googleapis.com",          // Chrome, Edge, Brave, Opera (Android + desktop)
        "push.apple.com",              // Safari (web.push.apple.com)
        "push.services.mozilla.com",   // Firefox
        "notify.windows.com",          // Edge legacy / Windows (*.notify.windows.com)
        "push.opera.com"
    ];
}
