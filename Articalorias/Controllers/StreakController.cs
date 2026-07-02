using System.Security.Claims;
using Articalorias.DTOs.Streaks;
using Articalorias.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Articalorias.Controllers;

[ApiController]
[Route("api/streak")]
[Authorize]
public class StreakController : ControllerBase
{
    private readonly IStreakService _streakService;

    public StreakController(IStreakService streakService)
    {
        _streakService = streakService;
    }

    /// <summary>GET /api/streak — returns the authenticated user's current streak state.</summary>
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var userId = GetUserId();
        var dto = await _streakService.GetOrCreateAsync(userId, ct);
        return Ok(dto);
    }

    /// <summary>PUT /api/streak/settings — enable or disable streak tracking.</summary>
    [HttpPut("settings")]
    public async Task<IActionResult> UpdateSettings(
        [FromBody] UpdateStreakSettingsRequest request,
        CancellationToken ct)
    {
        var userId = GetUserId();
        var dto = await _streakService.UpdateSettingsAsync(userId, request.StreakEnabled, ct);
        return Ok(dto);
    }

    /// <summary>POST /api/streak/reset — reset the current streak to 0.</summary>
    [HttpPost("reset")]
    public async Task<IActionResult> Reset(CancellationToken ct)
    {
        var userId = GetUserId();
        var dto = await _streakService.ResetAsync(userId, ct);
        return Ok(dto);
    }

    private long GetUserId() =>
        long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
