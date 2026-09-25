using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Push;

/// <summary>
/// A browser push subscription. The endpoint is a URL the server will POST to
/// later, so it is validated as an absolute HTTPS URL here and checked against
/// the push-service host allowlist in the service (server-side request forgery
/// guard: never let a client point the API at an arbitrary address).
/// </summary>
public class SavePushSubscriptionRequest
{
    [Required]
    [StringLength(2048)]
    [Url]
    public string Endpoint { get; set; } = string.Empty;

    [Required]
    [StringLength(512)]
    public string P256DH { get; set; } = string.Empty;

    [Required]
    [StringLength(256)]
    public string Auth { get; set; } = string.Empty;
}
