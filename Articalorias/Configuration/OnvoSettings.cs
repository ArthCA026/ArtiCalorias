namespace Articalorias.Configuration;

/// <summary>
/// Credentials for the ONVO Pay account that collects the ArtiCalorias
/// subscription (https://docs.onvopay.com). All three values are secrets-store
/// material: user secrets locally, App Settings in Azure. Never commit them.
/// </summary>
public class OnvoSettings
{
    public const string SectionName = "Onvo";

    private const string Placeholder = "OVERRIDE-VIA-USER-SECRETS-OR-AZURE-APP-SETTINGS";

    /// <summary>Server-side API key (onvo_test_secret_key_... / onvo_live_secret_key_...).</summary>
    public string SecretKey { get; set; } = string.Empty;

    /// <summary>
    /// Browser-safe key (onvo_test_publishable_key_... / onvo_live_publishable_key_...).
    /// Served to the client by the checkout endpoint so it always belongs to
    /// the same account and mode as <see cref="SecretKey"/>.
    /// </summary>
    public string PublishableKey { get; set; } = string.Empty;

    /// <summary>
    /// Secret ONVO sends in the X-Webhook-Secret header (webhook_secret_...),
    /// shown next to the webhook in the ONVO dashboard.
    /// </summary>
    public string WebhookSecret { get; set; } = string.Empty;

    /// <summary>API host without the version path. Only ever overridden to point tests at a stub.</summary>
    public string ApiBaseUrl { get; set; } = "https://api.onvopay.com";

    public int TimeoutSeconds { get; set; } = 20;

    public bool HasSecretKey => IsSet(SecretKey);
    public bool HasPublishableKey => IsSet(PublishableKey);
    public bool HasWebhookSecret => IsSet(WebhookSecret);

    /// <summary>
    /// "test" or "live", read from the secret key prefix; null when the key is
    /// missing or unrecognizable. Subscriptions are stored with the mode they
    /// were created in and only ever grant access in that same mode, so a
    /// test-card purchase can never unlock a live deployment.
    /// </summary>
    public string? Mode => ModeOf(SecretKey);

    /// <summary>Both keys present and from the same mode: checkout can run.</summary>
    public bool IsCheckoutConfigured =>
        HasSecretKey && HasPublishableKey && Mode is not null && Mode == ModeOf(PublishableKey);

    private static string? ModeOf(string key)
    {
        if (!IsSet(key)) return null;
        if (key.StartsWith("onvo_live_", StringComparison.Ordinal)) return OnvoModes.Live;
        if (key.StartsWith("onvo_test_", StringComparison.Ordinal)) return OnvoModes.Test;
        return null;
    }

    private static bool IsSet(string value) =>
        !string.IsNullOrWhiteSpace(value) && value != Placeholder;
}

public static class OnvoModes
{
    public const string Test = "test";
    public const string Live = "live";
}
