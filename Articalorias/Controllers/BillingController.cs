using System.Security.Claims;
using Articalorias.DTOs.Billing;
using Articalorias.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Articalorias.Controllers;

/// <summary>
/// The account's own subscription. Every action works on the signed-in user
/// only: no endpoint accepts a user id or an ONVO id from the client, so there
/// is nothing to tamper with. Open to accounts without access (it is how they
/// get it) and without consent (a subscriber must always be able to cancel).
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BillingController : ControllerBase
{
    private readonly IBillingService _billing;

    public BillingController(IBillingService billing)
    {
        _billing = billing;
    }

    /// <summary>Access, current subscription and the plan catalogue, in one call.</summary>
    [HttpGet("status")]
    public async Task<ActionResult<BillingStatusResponse>> GetStatus(CancellationToken ct)
    {
        return Ok(await _billing.GetStatusAsync(GetUserId(), ct));
    }

    /// <summary>
    /// Prepares a purchase and returns what ONVO's browser SDK needs to collect
    /// the card. Nothing is charged here, and card data never reaches this API.
    /// </summary>
    [HttpPost("checkout")]
    public async Task<ActionResult<StartCheckoutResponse>> StartCheckout([FromBody] StartCheckoutRequest request, CancellationToken ct)
    {
        return Ok(await _billing.StartCheckoutAsync(GetUserId(), request, ct));
    }

    /// <summary>Re-reads the subscription from ONVO: after paying, or from "refresh status".</summary>
    [HttpPost("sync")]
    public async Task<ActionResult<BillingStatusResponse>> Sync(CancellationToken ct)
    {
        return Ok(await _billing.SyncAsync(GetUserId(), ct));
    }

    /// <summary>Stops the renewal. Access continues to the end of the period already paid.</summary>
    [HttpPost("cancel")]
    public async Task<ActionResult<BillingStatusResponse>> Cancel(CancellationToken ct)
    {
        return Ok(await _billing.CancelAsync(GetUserId(), ct));
    }

    /// <summary>Undoes a cancellation that has not taken effect yet.</summary>
    [HttpPost("resume")]
    public async Task<ActionResult<BillingStatusResponse>> Resume(CancellationToken ct)
    {
        return Ok(await _billing.ResumeAsync(GetUserId(), ct));
    }

    private long GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException();
        return long.Parse(claim.Value);
    }
}
