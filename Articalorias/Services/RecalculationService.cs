using Articalorias.Configuration;
using Articalorias.Data;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Services;

/// <summary>
/// Authoritative recalculation pipeline.
/// Every insert, update, or delete of food/activity triggers this.
/// The database stores the OFFICIAL calculated state after this runs.
/// </summary>
public class RecalculationService : IRecalculationService
{
    private readonly AppDbContext _db;

    public RecalculationService(AppDbContext db)
    {
        _db = db;
    }

    public async Task RecalculateFullPipelineAsync(long dailyLogId)
    {
        // ── Step 1: Load DailyLog with all children ──
        var log = await _db.DailyLogs
            .Include(d => d.FoodEntries)
            .Include(d => d.ActivityEntries)
                .ThenInclude(a => a.Segments)
            .FirstOrDefaultAsync(d => d.DailyLogId == dailyLogId)
            ?? throw new InvalidOperationException("DailyLog not found.");

        // ── Step 2: Recompute food intake totals ──
        log.TotalFoodCaloriesKcal = log.FoodEntries.Sum(f => f.CaloriesKcal);
        log.TotalProteinGrams = log.FoodEntries.Sum(f => f.ProteinGrams);
        log.TotalFatGrams = log.FoodEntries.Sum(f => f.FatGrams);
        log.TotalCarbsGrams = log.FoodEntries.Sum(f => f.CarbsGrams);
        log.TotalAlcoholGrams = log.FoodEntries.Sum(f => f.AlcoholGrams);

        // ── Step 3: Recompute activity totals ──
        log.TotalActivityCaloriesKcal = log.ActivityEntries.Sum(a => a.CalculatedCaloriesKcal);

        // ── Step 3b: Recompute idle-time expenditure (unregistered hours) ──
        var totalActivityMinutes = log.ActivityEntries.Sum(a => a.DurationMinutes ?? 0m);
        var totalActivityHours = totalActivityMinutes / 60m;
        log.HoursRemainingInDay = Math.Max(0m, 24m - totalActivityHours);
        // Idle MET 1.2 minus 1 MET (resting component already in BMR) = 0.2 net
        log.IdleTimeCaloriesKcal = (1.2m - 1m) * log.SnapshotWeightKg * log.HoursRemainingInDay;

        // ── Step 4: Recompute TEF (per-macro business logic) ──
        log.TEFKcal = TefConstants.Calculate(
            log.TotalProteinGrams,
            log.TotalFatGrams,
            log.TotalCarbsGrams,
            log.TotalAlcoholGrams);

        // ── Step 5: Recompute total daily expenditure ──
        log.TotalDailyExpenditureKcal = log.SnapshotBMRKcal
            + log.TotalActivityCaloriesKcal
            + log.IdleTimeCaloriesKcal
            + log.TEFKcal;

        // ── Step 6: Recompute net balance ──
        log.NetBalanceKcal = log.TotalFoodCaloriesKcal - log.TotalDailyExpenditureKcal;

        // ── Step 7: Recompute daily remaining (calories + protein) ──
        log.DailyGoalDeltaKcal = log.NetBalanceKcal - log.SnapshotDailyBaseGoalKcal;
        log.CaloriesRemainingToDailyTargetKcal =
            (log.TotalDailyExpenditureKcal + log.SnapshotDailyBaseGoalKcal) - log.TotalFoodCaloriesKcal;
        log.ProteinRemainingGrams = log.SnapshotProteinGoalGrams - log.TotalProteinGrams;

        // ── Step 8: Recompute weekly dynamic context ──
        await RecalculateWeeklyContext(log);

        log.LastRecalculatedAtUtc = DateTime.UtcNow;
        log.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // ── Step 9: Update WeeklySummary ──
        await RecalculateWeeklySummary(log.UserId, log.WeekStartDate, log.WeekEndDate, log.SnapshotDailyBaseGoalKcal);

        // ── Step 10: Update MonthlySummary ──
        await RecalculateMonthlySummary(log.UserId, log.LogDate.Year, log.LogDate.Month);
    }

    // ─────────────────────────────────────────────────────
    //  Step 8 — Weekly context fields on the DailyLog itself
    // ─────────────────────────────────────────────────────

    private async Task RecalculateWeeklyContext(DailyLog log)
    {
        var weekLogs = await _db.DailyLogs
            .Where(d => d.UserId == log.UserId
                && d.WeekStartDate == log.WeekStartDate
                && d.DailyLogId != log.DailyLogId)
            .ToListAsync();

        var allWeekBalances = weekLogs.Sum(d => d.NetBalanceKcal) + log.NetBalanceKcal;
        var dayOfWeek = log.LogDate.DayNumber - log.WeekStartDate.DayNumber + 1;
        var daysRemaining = 7 - dayOfWeek;

        log.WeeklyTargetKcal = log.SnapshotDailyBaseGoalKcal * 7;
        log.WeeklyExpectedToDateKcal = log.SnapshotDailyBaseGoalKcal * dayOfWeek;
        log.WeeklyActualToDateKcal = allWeekBalances;
        log.WeeklyDifferenceKcal = log.WeeklyActualToDateKcal - log.WeeklyExpectedToDateKcal;
        log.WeeklyRemainingTargetKcal = log.WeeklyTargetKcal - log.WeeklyActualToDateKcal;
        log.SuggestedDailyAverageRemainingKcal = daysRemaining > 0
            ? log.WeeklyRemainingTargetKcal / daysRemaining
            : 0m;
    }

    // ─────────────────────────────────────────────────────
    //  Step 9 — Persist WeeklySummary
    // ─────────────────────────────────────────────────────

    private async Task RecalculateWeeklySummary(long userId, DateOnly weekStart, DateOnly weekEnd, decimal baseDailyGoal)
    {
        var logs = await _db.DailyLogs
            .Where(d => d.UserId == userId && d.LogDate >= weekStart && d.LogDate <= weekEnd)
            .AsNoTracking()
            .ToListAsync();

        var summary = await _db.WeeklySummaries
            .FirstOrDefaultAsync(w => w.UserId == userId && w.WeekStartDate == weekStart);

        if (summary is null)
        {
            summary = new WeeklySummary
            {
                UserId = userId,
                WeekStartDate = weekStart,
                WeekEndDate = weekEnd,
                BaseDailyGoalKcalUsed = baseDailyGoal,
                ExpectedWeeklyTargetKcal = baseDailyGoal * 7
            };
            _db.WeeklySummaries.Add(summary);
        }

        summary.TotalFoodCaloriesKcal = logs.Sum(d => d.TotalFoodCaloriesKcal);
        summary.TotalProteinGrams = logs.Sum(d => d.TotalProteinGrams);
        summary.TotalFatGrams = logs.Sum(d => d.TotalFatGrams);
        summary.TotalCarbsGrams = logs.Sum(d => d.TotalCarbsGrams);
        summary.TotalAlcoholGrams = logs.Sum(d => d.TotalAlcoholGrams);
        summary.TotalActivityCaloriesKcal = logs.Sum(d => d.TotalActivityCaloriesKcal);
        summary.TotalTEFKcal = logs.Sum(d => d.TEFKcal);
        summary.TotalExpenditureKcal = logs.Sum(d => d.TotalDailyExpenditureKcal);
        summary.ActualWeeklyBalanceKcal = logs.Sum(d => d.NetBalanceKcal);
        summary.DaysLogged = logs.Count;

        summary.DifferenceVsTargetKcal = summary.ActualWeeklyBalanceKcal - summary.ExpectedWeeklyTargetKcal;

        var daysRemaining = 7 - summary.DaysLogged;
        summary.RemainingTargetKcal = summary.ExpectedWeeklyTargetKcal - summary.ActualWeeklyBalanceKcal;
        summary.RequiredDailyAverageRemainingKcal = daysRemaining > 0
            ? summary.RemainingTargetKcal / daysRemaining
            : 0m;

        // 1 kg ≈ 7700 kcal
        summary.EstimatedWeightChangeKg = summary.ActualWeeklyBalanceKcal / 7700m;

        summary.LastCalculatedAtUtc = DateTime.UtcNow;
        summary.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();
    }

    // ─────────────────────────────────────────────────────
    //  Step 10 — Persist MonthlySummary
    // ─────────────────────────────────────────────────────

    private async Task RecalculateMonthlySummary(long userId, int year, int month)
    {
        var monthStart = new DateOnly(year, month, 1);
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);

        var logs = await _db.DailyLogs
            .Where(d => d.UserId == userId && d.LogDate >= monthStart && d.LogDate <= monthEnd)
            .AsNoTracking()
            .ToListAsync();

        var summary = await _db.MonthlySummaries
            .FirstOrDefaultAsync(m => m.UserId == userId && m.YearNumber == year && m.MonthNumber == month);

        if (summary is null)
        {
            summary = new MonthlySummary
            {
                UserId = userId,
                YearNumber = year,
                MonthNumber = month,
                MonthStartDate = monthStart,
                MonthEndDate = monthEnd
            };
            _db.MonthlySummaries.Add(summary);
        }

        summary.TotalFoodCaloriesKcal = logs.Sum(d => d.TotalFoodCaloriesKcal);
        summary.TotalProteinGrams = logs.Sum(d => d.TotalProteinGrams);
        summary.TotalFatGrams = logs.Sum(d => d.TotalFatGrams);
        summary.TotalCarbsGrams = logs.Sum(d => d.TotalCarbsGrams);
        summary.TotalAlcoholGrams = logs.Sum(d => d.TotalAlcoholGrams);
        summary.TotalActivityCaloriesKcal = logs.Sum(d => d.TotalActivityCaloriesKcal);
        summary.TotalTEFKcal = logs.Sum(d => d.TEFKcal);
        summary.TotalExpenditureKcal = logs.Sum(d => d.TotalDailyExpenditureKcal);
        summary.ActualMonthlyBalanceKcal = logs.Sum(d => d.NetBalanceKcal);
        summary.DaysLogged = logs.Count;

        if (summary.DaysLogged > 0)
        {
            summary.AverageDailyFoodCaloriesKcal = summary.TotalFoodCaloriesKcal / summary.DaysLogged;
            summary.AverageDailyExpenditureKcal = summary.TotalExpenditureKcal / summary.DaysLogged;
            summary.AverageDailyBalanceKcal = summary.ActualMonthlyBalanceKcal / summary.DaysLogged;
            summary.AverageWeeklyBalanceKcal = summary.AverageDailyBalanceKcal * 7;
        }

        // 1 kg ≈ 7700 kcal
        summary.EstimatedWeightChangeKg = summary.ActualMonthlyBalanceKcal / 7700m;

        summary.LastCalculatedAtUtc = DateTime.UtcNow;
        summary.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();
    }
}
