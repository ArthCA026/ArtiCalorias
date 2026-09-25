using Articalorias.DTOs.DailyLogs;
using Articalorias.DTOs.Summaries;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Articalorias.Extensions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Articalorias.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class HistoryController : ControllerBase
{
    private readonly IDailyLogService _dailyLogService;
    private readonly IMonthlySummaryService _monthlySummaryService;

    public HistoryController(
        IDailyLogService dailyLogService,
        IMonthlySummaryService monthlySummaryService)
    {
        _dailyLogService = dailyLogService;
        _monthlySummaryService = monthlySummaryService;
    }

    // ── Daily history ──

    /// <summary>Longest span one call may ask for; the app pages by week or month.</summary>
    public const int MaxRangeDays = 366;

    [HttpGet("daily")]
    public async Task<IActionResult> GetDailyRange([FromQuery] DateOnly from, [FromQuery] DateOnly to)
    {
        if (to < from)
            return BadRequest(new { Message = "'to' must not be before 'from'." });
        if (to.DayNumber - from.DayNumber >= MaxRangeDays)
            return BadRequest(new { Message = $"Ranges are limited to {MaxRangeDays} days per request." });

        var userId = User.GetUserId();
        var logs = await _dailyLogService.GetRangeAsync(userId, from, to);
        return Ok(logs.Select(MapDailyLogToResponse));
    }

    // ── Monthly summaries ──

    [HttpGet("monthly/{year}")]
    public async Task<IActionResult> GetMonthlyByYear(int year)
    {
        var userId = User.GetUserId();
        var summaries = await _monthlySummaryService.GetByYearAsync(userId, year);
        return Ok(summaries.Select(MapMonthlyToResponse));
    }

    [HttpGet("monthly/{year}/{month}")]
    public async Task<IActionResult> GetMonthly(int year, int month)
    {
        var userId = User.GetUserId();
        var summary = await _monthlySummaryService.GetByMonthAsync(userId, year, month);
        if (summary is null)
            return NotFound();

        return Ok(MapMonthlyToResponse(summary));
    }

    // ── Helpers ──

    /// <summary>One mapper for every daily payload (see DailyLogController.MapToResponse).</summary>
    private static DailyLogResponse MapDailyLogToResponse(DailyLog d) => DailyLogController.MapToResponse(d);

    private static MonthlySummaryResponse MapMonthlyToResponse(MonthlySummary m) => new()
    {
        MonthlySummaryId = m.MonthlySummaryId,
        YearNumber = m.YearNumber,
        MonthNumber = m.MonthNumber
    };
}
