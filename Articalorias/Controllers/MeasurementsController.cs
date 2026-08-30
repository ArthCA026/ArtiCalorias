using System.Security.Claims;
using Articalorias.DTOs.Measurements;
using Articalorias.Interfaces;
using Articalorias.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Articalorias.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MeasurementsController : ControllerBase
{
    private readonly IBodyMeasurementService _measurements;
    private readonly IUserProfileService _profileService;

    public MeasurementsController(IBodyMeasurementService measurements, IUserProfileService profileService)
    {
        _measurements = measurements;
        _profileService = profileService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var userId = GetUserId();
        var items = await _measurements.GetAllAsync(userId, ct);
        return Ok(items);
    }

    /// <summary>
    /// Creates or updates the measurement of one calendar day. The optional
    /// <paramref name="today"/> query param carries the client's local date so
    /// "not in the future" and the profile sync run on the user's calendar.
    /// </summary>
    [HttpPut("{date}")]
    public async Task<IActionResult> Upsert(DateOnly date, [FromBody] UpsertBodyMeasurementRequest request, [FromQuery] DateOnly? today, CancellationToken ct)
    {
        var userId = GetUserId();
        var localToday = await ResolveLocalTodayAsync(userId, today);
        var saved = await _measurements.UpsertAsync(userId, date, request, localToday, ct);
        return Ok(saved);
    }

    [HttpDelete("{date}")]
    public async Task<IActionResult> Delete(DateOnly date, [FromQuery] DateOnly? today, CancellationToken ct)
    {
        var userId = GetUserId();
        var localToday = await ResolveLocalTodayAsync(userId, today);
        var deleted = await _measurements.DeleteAsync(userId, date, localToday, ct);
        return deleted ? NoContent() : NotFound();
    }

    /// <summary>
    /// Multi-select delete: removes several days' measurements and syncs the
    /// profile to the surviving newest measurement once.
    /// </summary>
    [HttpPost("delete-batch")]
    public async Task<IActionResult> DeleteBatch([FromBody] DeleteMeasurementsRequest request, [FromQuery] DateOnly? today, CancellationToken ct)
    {
        var userId = GetUserId();
        var localToday = await ResolveLocalTodayAsync(userId, today);
        var deleted = await _measurements.DeleteBatchAsync(userId, request.Dates, localToday, ct);
        return Ok(new { deleted });
    }

    private async Task<DateOnly> ResolveLocalTodayAsync(long userId, DateOnly? clientToday)
    {
        var profile = await _profileService.GetByUserIdAsync(userId);
        return LocalDates.Resolve(clientToday, profile?.TimeZoneId);
    }

    private long GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException();
        return long.Parse(claim.Value);
    }
}
