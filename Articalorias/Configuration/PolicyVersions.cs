namespace Articalorias.Configuration;

/// <summary>
/// The consent types users grant or revoke (Ley 8968). "health_data" is the
/// separate express consent for sensitive data (Art. 9) - distinct from the
/// general terms/privacy acceptance by design.
/// </summary>
public static class ConsentTypes
{
    public const string Terms = "terms";
    public const string Privacy = "privacy";
    public const string HealthData = "health_data";

    public static readonly string[] All = [Terms, Privacy, HealthData];
}

public static class ConsentActions
{
    public const string Granted = "granted";
    public const string Revoked = "revoked";
}

public static class ConsentSources
{
    public const string Register = "register";
    public const string Reconsent = "reconsent";
    public const string Profile = "profile";
}

public static class ConsentLocales
{
    /// <summary>The audit row records the language the text was shown in;
    /// anything unexpected falls back to Spanish, the primary locale.</summary>
    public static string Normalize(string? locale)
    {
        var normalized = (locale ?? string.Empty).Trim().ToLowerInvariant();
        return normalized is "en" or "es" ? normalized : "es";
    }
}

/// <summary>
/// Current versions of the legal documents, as ISO-date strings. The server is
/// authoritative: grants at any other version are rejected as stale, so a user
/// can never be recorded as consenting to text they were not shown.
/// Must match Articalorias.UI/src/legal/policyVersions.ts - bump both in the
/// same commit that changes the policy text.
/// </summary>
public static class PolicyVersions
{
    public const string Terms = "2026-09-09";
    public const string Privacy = "2026-09-09";
    public const string HealthData = "2026-09-09";

    public static readonly IReadOnlyDictionary<string, string> Current = new Dictionary<string, string>
    {
        [ConsentTypes.Terms] = Terms,
        [ConsentTypes.Privacy] = Privacy,
        [ConsentTypes.HealthData] = HealthData
    };
}
