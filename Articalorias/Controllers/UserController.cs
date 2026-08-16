using System.Security.Claims;
using Articalorias.Data;
using Articalorias.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UserController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly AppDbContext _db;

    public UserController(IUserService userService, AppDbContext db)
    {
        _userService = userService;
        _db = db;
    }

    /// <summary>
    /// Marks the user as actively present. The client sends this when the app
    /// becomes visible (throttled), NOT on background refetches, so a zombie
    /// tab left open cannot look like a living user. Keeps template auto-add
    /// alive; after <see cref="Services.DailyLogService.AutoAddPauseAfterDays"/>
    /// days of silence, new days stop materializing routine meals.
    /// </summary>
    [HttpPost("heartbeat")]
    public async Task<IActionResult> Heartbeat()
    {
        var userId = GetUserId();

        // Direct set-based update: no row round-trip, no RowVersion conflicts
        // with whatever else the session is doing at open.
        await _db.Users
            .Where(u => u.UserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.LastActiveAtUtc, DateTime.UtcNow));

        return NoContent();
    }

    /// <summary>Deletes all daily logs, food entries, activity entries, and monthly
    /// summaries for the authenticated user. Account and profile settings are kept.</summary>
    [HttpDelete("history")]
    public async Task<IActionResult> ClearHistory()
    {
        var userId = GetUserId();
        await _userService.ClearHistoryAsync(userId);
        return NoContent();
    }

    /// <summary>Permanently deletes the authenticated user's account and all associated data.</summary>
    [HttpDelete("account")]
    public async Task<IActionResult> DeleteAccount()
    {
        var userId = GetUserId();
        await _userService.DeleteAccountAsync(userId);
        return NoContent();
    }

    private long GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException();
        return long.Parse(claim.Value);
    }
}
