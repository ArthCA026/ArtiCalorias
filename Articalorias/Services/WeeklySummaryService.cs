using Articalorias.Data;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Services;

public class WeeklySummaryService : IWeeklySummaryService
{
    private readonly AppDbContext _db;

    public WeeklySummaryService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<WeeklySummary?> GetByWeekAsync(long userId, DateOnly weekStartDate)
    {
        return await _db.WeeklySummaries
            .FirstOrDefaultAsync(w => w.UserId == userId && w.WeekStartDate == weekStartDate);
    }

    public async Task<IReadOnlyList<WeeklySummary>> GetRangeAsync(long userId, DateOnly from, DateOnly to)
    {
        return await _db.WeeklySummaries
            .Where(w => w.UserId == userId && w.WeekStartDate >= from && w.WeekStartDate <= to)
            .OrderBy(w => w.WeekStartDate)
            .ToListAsync();
    }

    public async Task RecalculateAsync(long userId, DateOnly weekStartDate)
    {
        var weekEndDate = weekStartDate.AddDays(6);

        var logs = await _db.DailyLogs
            .Where(d => d.UserId == userId && d.LogDate >= weekStartDate && d.LogDate <= weekEndDate)
            .ToListAsync();

        var summary = await _db.WeeklySummaries
            .FirstOrDefaultAsync(w => w.UserId == userId && w.WeekStartDate == weekStartDate);

        var baseDailyGoal = logs.FirstOrDefault()?.SnapshotDailyBaseGoalKcal ?? -500m;

        if (summary is null)
        {
            summary = new WeeklySummary
            {
                UserId = userId,
                WeekStartDate = weekStartDate,
                WeekEndDate = weekEndDate,
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
}
