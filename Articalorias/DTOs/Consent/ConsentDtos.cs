using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Consent;

/// <summary>Current version of one legal document users consent to.</summary>
public class PolicyVersionInfo
{
    public string ConsentType { get; set; } = string.Empty;
    public string CurrentVersion { get; set; } = string.Empty;
}

public class PolicyVersionsResponse
{
    public List<PolicyVersionInfo> Policies { get; set; } = [];
}

/// <summary>Latest consent state for one consent type.</summary>
public class ConsentStateItem
{
    public string ConsentType { get; set; } = string.Empty;

    /// <summary>"granted" | "revoked" | "none" (never recorded).</summary>
    public string Status { get; set; } = string.Empty;

    public string? PolicyVersion { get; set; }
    public DateTime? RecordedAtUtc { get; set; }

    /// <summary>True when granted at the currently required version.</summary>
    public bool IsCurrent { get; set; }
}

/// <summary>One row of the append-only audit trail.</summary>
public class ConsentHistoryItem
{
    public string ConsentType { get; set; } = string.Empty;
    public string PolicyVersion { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Locale { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
}

public class ConsentStateResponse
{
    public List<ConsentStateItem> Consents { get; set; } = [];

    /// <summary>Consent types that are missing, revoked, or granted at a stale
    /// version. The frontend gate blocks the app while this is non-empty.</summary>
    public List<string> RequiresConsent { get; set; } = [];

    /// <summary>Full audit trail, newest first.</summary>
    public List<ConsentHistoryItem> History { get; set; } = [];
}

/// <summary>A single grant or revocation the user made in the UI.</summary>
public class ConsentDecision
{
    [Required]
    [StringLength(30)]
    public string ConsentType { get; set; } = string.Empty;

    /// <summary>The version the user was shown. Grants must match the server's
    /// current version; for revocations the server records the version the
    /// user actually held, regardless of this value.</summary>
    [Required]
    [StringLength(20)]
    public string PolicyVersion { get; set; } = string.Empty;

    /// <summary>"granted" | "revoked".</summary>
    [Required]
    [StringLength(10)]
    public string Action { get; set; } = string.Empty;
}

public class RecordConsentRequest
{
    [Required]
    [MinLength(1)]
    public List<ConsentDecision> Consents { get; set; } = [];

    /// <summary>UI language the documents were displayed in ("es" | "en").</summary>
    [Required]
    [StringLength(5)]
    public string Locale { get; set; } = "es";

    /// <summary>"reconsent" (blocking gate) | "profile" (settings). Register
    /// rows are written by the register endpoint itself.</summary>
    [Required]
    [StringLength(20)]
    public string Source { get; set; } = "reconsent";
}
