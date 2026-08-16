using System.Security.Claims;
using Articalorias.DTOs.Macros;
using Articalorias.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Articalorias.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MacroPreferencesController : ControllerBase
{
    private readonly IMacroPreferenceService _macroPreferences;

    public MacroPreferencesController(IMacroPreferenceService macroPreferences)
    {
        _macroPreferences = macroPreferences;
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var userId = GetUserId();
        var prefs = await _macroPreferences.GetForUserAsync(userId, ct);
        return Ok(prefs);
    }

    /// <summary>
    /// Saves tracking settings. The client follows up with a refresh-snapshot
    /// call for its local today so the change applies from today only: past
    /// days keep the targets they were lived under.
    /// </summary>
    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdateMacroPreferencesRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        var prefs = await _macroPreferences.UpdateAsync(userId, request, ct);
        return Ok(prefs);
    }

    private long GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException();
        return long.Parse(claim.Value);
    }
}
