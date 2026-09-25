using Articalorias.Data;
using Articalorias.DTOs.Auth;
using Articalorias.Extensions;
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
    private readonly IAuthService _authService;
    private readonly AppDbContext _db;

    public UserController(IUserService userService, IAuthService authService, AppDbContext db)
    {
        _userService = userService;
        _authService = authService;
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
        var userId = User.GetUserId();

        // Direct set-based update: no row round-trip, no RowVersion conflicts
        // with whatever else the session is doing at open.
        await _db.Users
            .Where(u => u.UserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.LastActiveAtUtc, DateTime.UtcNow));

        return NoContent();
    }

    /// <summary>
    /// Signed-in password change. Answers with fresh tokens for this session;
    /// every other session is signed out.
    /// </summary>
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken ct)
    {
        var result = await _authService.ChangePasswordAsync(User.GetUserId(), request, ct);
        return Ok(result);
    }

    /// <summary>Deletes all daily logs, food entries, activity entries, and monthly
    /// summaries for the authenticated user. Account and profile settings are kept.
    /// Irreversible, so the current password is required: a bearer token alone
    /// (one XSS away in a browser) must not be enough to erase a history.</summary>
    [HttpDelete("history")]
    public async Task<IActionResult> ClearHistory([FromBody] ConfirmPasswordRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        await _authService.VerifyPasswordAsync(userId, request.Password, ct);
        await _userService.ClearHistoryAsync(userId);
        return NoContent();
    }

    /// <summary>Permanently deletes the authenticated user's account and all associated
    /// data. Requires the current password for the same reason as history deletion.</summary>
    [HttpDelete("account")]
    public async Task<IActionResult> DeleteAccount([FromBody] ConfirmPasswordRequest request, CancellationToken ct)
    {
        var userId = User.GetUserId();
        await _authService.VerifyPasswordAsync(userId, request.Password, ct);
        await _userService.DeleteAccountAsync(userId);
        return NoContent();
    }

    /// <summary>Ley 8968 access right: every piece of data the account holds,
    /// as one JSON document. Credentials are never included.</summary>
    [HttpGet("export")]
    public async Task<IActionResult> ExportData()
    {
        var userId = User.GetUserId();
        var export = await _userService.ExportAsync(userId);
        if (export is null) return NotFound();
        return Ok(export);
    }
}
