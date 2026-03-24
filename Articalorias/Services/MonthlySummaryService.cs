using Articalorias.Data;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Services;

public class MonthlySummaryService : IMonthlySummaryService
{
    private readonly AppDbContext _db;

    public MonthlySummaryService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<MonthlySummary?> GetByMonthAsync(long userId, int year, int month)
    {
        return await _db.MonthlySummaries
            .FirstOrDefaultAsync(m => m.UserId == userId && m.YearNumber == year && m.MonthNumber == month);
    }

    public async Task<IReadOnlyList<MonthlySummary>> GetByYearAsync(long userId, int year)
    {
        return await _db.MonthlySummaries
            .Where(m => m.UserId == userId && m.YearNumber == year)
            .OrderBy(m => m.MonthNumber)
            .ToListAsync();
    }

    public async Task RecalculateAsync(long userId, int year, int month)
    {
        var monthStart = new DateOnly(year, month, 1);
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);

        var logs = await _db.DailyLogs
            .Where(d => d.UserId == userId && d.LogDate >= monthStart && d.LogDate <= monthEnd)
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
