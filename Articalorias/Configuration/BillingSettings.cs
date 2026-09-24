namespace Articalorias.Configuration;

/// <summary>
/// Master switch for the subscription requirement.
/// </summary>
public class BillingSettings
{
    public const string SectionName = "Billing";

    /// <summary>
    /// False: nobody is asked to pay and the whole API stays open, exactly as
    /// before subscriptions existed (the client hides every billing screen).
    /// True: every account needs a paid subscription or a
    /// <see cref="SubscriptionWhitelist"/> entry to use the app.
    /// Flip it per environment (appsettings.Development.json, Azure App
    /// Settings "Billing__Enabled") - never in code.
    /// </summary>
    public bool Enabled { get; set; }
}
