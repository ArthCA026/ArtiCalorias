using System.Security.Claims;
using Articalorias.Configuration;
using Articalorias.DTOs.Consent;
using Articalorias.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Articalorias.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ConsentController : ControllerBase
{
    private readonly IConsentService _consentService;

    public ConsentController(IConsentService consentService)
    {
        _consentService = consentService;
    }

    /// <summary>Current versions of the legal documents. Anonymous because the
    /// register page shows them before an account exists.</summary>
    [HttpGet("policies")]
    [AllowAnonymous]
    public ActionResult<PolicyVersionsResponse> GetPolicies()
    {
        var response = new PolicyVersionsResponse
        {
            Policies = PolicyVersions.Current
                .Select(kv => new PolicyVersionInfo { ConsentType = kv.Key, CurrentVersion = kv.Value })
                .ToList()
        };
        return Ok(response);
    }

    /// <summary>Latest consent state per type plus the full audit trail.</summary>
    [HttpGet]
    public async Task<ActionResult<ConsentStateResponse>> GetState()
    {
        return Ok(await _consentService.GetStateAsync(GetUserId()));
    }

    /// <summary>Records grants (re-consent gate) or revocations (profile).</summary>
    [HttpPost]
    public async Task<ActionResult<ConsentStateResponse>> Record([FromBody] RecordConsentRequest request)
    {
        return Ok(await _consentService.RecordAsync(GetUserId(), request));
    }

    private long GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException();
        return long.Parse(claim.Value);
    }
}
