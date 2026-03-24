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
    private readonly IWeeklySummaryService _weeklySummaryService;
    private readonly IMonthlySummaryService _monthlySummaryService;

    public HistoryController(
        IDailyLogService dailyLogService,
        IWeeklySummaryService weeklySummaryService,
        IMonthlySummaryService monthlySummaryService)
    {
        _dailyLogService = dailyLogService;
        _weeklySummaryService = weeklySummaryService;
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

    // ── Weekly summaries ──

    [HttpGet("weekly")]
    public async Task<IActionResult> GetWeeklyRange([FromQuery] DateOnly from, [FromQuery] DateOnly to)
    {
        var userId = GetUserId();
        var summaries = await _weeklySummaryService.GetRangeAsync(userId, from, to);
        return Ok(summaries.Select(MapWeeklyToResponse));
    }

    [HttpGet("weekly/{weekStartDate}")]
    public async Task<IActionResult> GetWeekly(DateOnly weekStartDate)
    {
        var userId = GetUserId();
        var summary = await _weeklySummaryService.GetByWeekAsync(userId, weekStartDate);
        if (summary is null)
            return NotFound();

        return Ok(MapWeeklyToResponse(summary));
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
        TotalFatGrams = d.TotalFatGrams,
        TotalCarbsGrams = d.TotalCarbsGrams,
        TotalAlcoholGrams = d.TotalAlcoholGrams,
        TotalActivityCaloriesKcal = d.TotalActivityCaloriesKcal,
        TEFKcal = d.TEFKcal,
        TotalDailyExpenditureKcal = d.TotalDailyExpenditureKcal,
        NetBalanceKcal = d.NetBalanceKcal,
        DailyGoalDeltaKcal = d.DailyGoalDeltaKcal,
        CaloriesRemainingToDailyTargetKcal = d.CaloriesRemainingToDailyTargetKcal,
        ProteinRemainingGrams = d.ProteinRemainingGrams,
        WeekStartDate = d.WeekStartDate,
        WeekEndDate = d.WeekEndDate,
        WeeklyTargetKcal = d.WeeklyTargetKcal,
        WeeklyActualToDateKcal = d.WeeklyActualToDateKcal,
        WeeklyExpectedToDateKcal = d.WeeklyExpectedToDateKcal,
        WeeklyDifferenceKcal = d.WeeklyDifferenceKcal,
        WeeklyRemainingTargetKcal = d.WeeklyRemainingTargetKcal,
        SuggestedDailyAverageRemainingKcal = d.SuggestedDailyAverageRemainingKcal,
        IsFinalized = d.IsFinalized,
        SnapshotWeightKg = d.SnapshotWeightKg,
        SnapshotDailyBaseGoalKcal = d.SnapshotDailyBaseGoalKcal,
        SnapshotProteinGoalGrams = d.SnapshotProteinGoalGrams
    };

    private static WeeklySummaryResponse MapWeeklyToResponse(WeeklySummary w) => new()
    {
        WeeklySummaryId = w.WeeklySummaryId,
        WeekStartDate = w.WeekStartDate,
        WeekEndDate = w.WeekEndDate,
        BaseDailyGoalKcalUsed = w.BaseDailyGoalKcalUsed,
        ExpectedWeeklyTargetKcal = w.ExpectedWeeklyTargetKcal,
        TotalFoodCaloriesKcal = w.TotalFoodCaloriesKcal,
        TotalProteinGrams = w.TotalProteinGrams,
        TotalActivityCaloriesKcal = w.TotalActivityCaloriesKcal,
        TotalTEFKcal = w.TotalTEFKcal,
        TotalExpenditureKcal = w.TotalExpenditureKcal,
        ActualWeeklyBalanceKcal = w.ActualWeeklyBalanceKcal,
        DifferenceVsTargetKcal = w.DifferenceVsTargetKcal,
        RemainingTargetKcal = w.RemainingTargetKcal,
        RequiredDailyAverageRemainingKcal = w.RequiredDailyAverageRemainingKcal,
        DaysLogged = w.DaysLogged,
        EstimatedWeightChangeKg = w.EstimatedWeightChangeKg
    };

    private static MonthlySummaryResponse MapMonthlyToResponse(MonthlySummary m) => new()
    {
        MonthlySummaryId = m.MonthlySummaryId,
        YearNumber = m.YearNumber,
        MonthNumber = m.MonthNumber,
        TotalFoodCaloriesKcal = m.TotalFoodCaloriesKcal,
        TotalProteinGrams = m.TotalProteinGrams,
        TotalActivityCaloriesKcal = m.TotalActivityCaloriesKcal,
        TotalTEFKcal = m.TotalTEFKcal,
        TotalExpenditureKcal = m.TotalExpenditureKcal,
        ActualMonthlyBalanceKcal = m.ActualMonthlyBalanceKcal,
        AverageDailyFoodCaloriesKcal = m.AverageDailyFoodCaloriesKcal,
        AverageDailyExpenditureKcal = m.AverageDailyExpenditureKcal,
        AverageDailyBalanceKcal = m.AverageDailyBalanceKcal,
        AverageWeeklyBalanceKcal = m.AverageWeeklyBalanceKcal,
        EstimatedWeightChangeKg = m.EstimatedWeightChangeKg,
        DaysLogged = m.DaysLogged
    };
}
