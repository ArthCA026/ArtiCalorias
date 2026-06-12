using System.Security.Claims;
using Articalorias.DTOs.Push;
using Articalorias.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Articalorias.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PushNotificationController : ControllerBase
{
    private readonly IPushNotificationService _push;

    public PushNotificationController(IPushNotificationService push)
    {
        _push = push;
    }

    [HttpGet("vapid-public-key")]
    public IActionResult GetVapidPublicKey()
    {
        return Ok(new { publicKey = _push.GetVapidPublicKey() });
    }

    [HttpPost("subscribe")]
    [Authorize]
    public async Task<IActionResult> Subscribe([FromBody] SavePushSubscriptionRequest request)
    {
        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        await _push.SubscribeAsync(userId, request.Endpoint, request.P256DH, request.Auth);
        return Ok();
    }

    [HttpDelete("unsubscribe")]
    [Authorize]
    public async Task<IActionResult> Unsubscribe([FromBody] SavePushSubscriptionRequest request)
    {
        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        await _push.UnsubscribeAsync(userId, request.Endpoint);
        return Ok();
    }

    [HttpGet("schedules")]
    [Authorize]
    public async Task<IActionResult> GetSchedules()
    {
        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var schedules = await _push.GetSchedulesAsync(userId);
        return Ok(schedules);
    }

    [HttpPut("schedules")]
    [Authorize]
    public async Task<IActionResult> UpdateSchedules([FromBody] UpdateSchedulesRequest request)
    {
        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        await _push.UpsertSchedulesAsync(userId, request.Schedules);
        return NoContent();
    }

#if DEBUG
    [HttpPost("test")]
    [Authorize]
    public async Task<IActionResult> Test()
    {
        var userId = long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        await _push.SendToUserAsync(userId, "🧪 Test notification", "Push notifications are working!");
        return Ok(new { message = "Notification sent." });
    }
#endif
}

