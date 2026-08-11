using System.Security.Claims;
using Articalorias.DTOs.DailyLogs;
using Articalorias.DTOs.Summaries;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
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

    [HttpGet("daily")]
    public async Task<IActionResult> GetDailyRange([FromQuery] DateOnly from, [FromQuery] DateOnly to)
    {
        var userId = GetUserId();
        var logs = await _dailyLogService.GetRangeAsync(userId, from, to);
        return Ok(logs.Select(MapDailyLogToResponse));
    }

    // ── Monthly summaries ──

    [HttpGet("monthly/{year}")]
    public async Task<IActionResult> GetMonthlyByYear(int year)
    {
        var userId = GetUserId();
        var summaries = await _monthlySummaryService.GetByYearAsync(userId, year);
        return Ok(summaries.Select(MapMonthlyToResponse));
    }

    [HttpGet("monthly/{year}/{month}")]
    public async Task<IActionResult> GetMonthly(int year, int month)
    {
        var userId = GetUserId();
        var summary = await _monthlySummaryService.GetByMonthAsync(userId, year, month);
        if (summary is null)
            return NotFound();

        return Ok(MapMonthlyToResponse(summary));
    }

    // ── Helpers ──

    private long GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException();
        return long.Parse(claim.Value);
    }

    private static DailyLogResponse MapDailyLogToResponse(DailyLog d) => new()
    {
        DailyLogId = d.DailyLogId,
        LogDate = d.LogDate,
        TotalFoodCaloriesKcal = d.TotalFoodCaloriesKcal,
        TotalProteinGrams = d.TotalProteinGrams,
        TotalDailyExpenditureKcal = d.TotalDailyExpenditureKcal,
        DailyGoalDeltaKcal = d.DailyGoalDeltaKcal,
        CaloriesRemainingToDailyTargetKcal = d.CaloriesRemainingToDailyTargetKcal,
        ProteinRemainingGrams = d.ProteinRemainingGrams,
        SuggestedDailyAverageRemainingKcal = d.SuggestedDailyAverageRemainingKcal,
        SnapshotProteinGoalGrams = d.SnapshotProteinGoalGrams,
        SnapshotDailyBaseGoalKcal = d.SnapshotDailyBaseGoalKcal,
        IsFastingDay = d.IsFastingDay,
        HasCalorieBudgetEstimate = d.SnapshotWeightKg.HasValue && d.SnapshotHeightCm.HasValue
    };

    private static MonthlySummaryResponse MapMonthlyToResponse(MonthlySummary m) => new()
    {
        MonthlySummaryId = m.MonthlySummaryId,
        YearNumber = m.YearNumber,
        MonthNumber = m.MonthNumber
    };
}
