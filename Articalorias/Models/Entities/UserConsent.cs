namespace Articalorias.Models.Entities;

/// <summary>
/// Append-only consent audit log (Ley 8968). One row per consent EVENT - a
/// grant or a revocation of one consent type at one policy version, in the
/// language it was shown. Rows are never updated or deleted individually;
/// the user's current state is the latest row per (UserId, ConsentType).
/// Cascade-deletes with the account so erasure stays complete.
/// </summary>
public class UserConsent
{
    public long UserConsentId { get; set; }
    public long UserId { get; set; }

    /// <summary>"terms" | "privacy" | "health_data".</summary>
    public string ConsentType { get; set; } = string.Empty;

    /// <summary>ISO-date version of the document shown, e.g. "2026-09-09".</summary>
    public string PolicyVersion { get; set; } = string.Empty;

    /// <summary>"granted" | "revoked".</summary>
    public string Action { get; set; } = string.Empty;

    /// <summary>UI language the text was shown in ("es" | "en").</summary>
    public string Locale { get; set; } = string.Empty;

    /// <summary>"register" | "reconsent" | "profile".</summary>
    public string Source { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; }

    // Navigation
    public User User { get; set; } = null!;
}
