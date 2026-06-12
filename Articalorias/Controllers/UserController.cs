using System.Security.Claims;
using Articalorias.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Articalorias.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UserController : ControllerBase
{
    private readonly IUserService _userService;

    public UserController(IUserService userService)
    {
        _userService = userService;
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
