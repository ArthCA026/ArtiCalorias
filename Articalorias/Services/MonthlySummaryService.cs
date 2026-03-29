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

        // Count all logged days including today
        summary.DaysLogged = logs.Count;

        // For calculations, exclude today's incomplete data
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var logsExcludingToday = logs.Where(d => d.LogDate < today).ToList();

        summary.TotalFoodCaloriesKcal = logsExcludingToday.Sum(d => d.TotalFoodCaloriesKcal);
        summary.TotalProteinGrams = logsExcludingToday.Sum(d => d.TotalProteinGrams);
        summary.TotalFatGrams = logsExcludingToday.Sum(d => d.TotalFatGrams);
        summary.TotalCarbsGrams = logsExcludingToday.Sum(d => d.TotalCarbsGrams);
        summary.TotalAlcoholGrams = logsExcludingToday.Sum(d => d.TotalAlcoholGrams);
        summary.TotalActivityCaloriesKcal = logsExcludingToday.Sum(d => d.TotalActivityCaloriesKcal);
        summary.TotalTEFKcal = logsExcludingToday.Sum(d => d.TEFKcal);
        summary.TotalExpenditureKcal = logsExcludingToday.Sum(d => d.TotalDailyExpenditureKcal);
        summary.ActualMonthlyBalanceKcal = logsExcludingToday.Sum(d => d.NetBalanceKcal);

        // Calculate averages based on completed days only
        var daysForCalculations = logsExcludingToday.Count;

        if (daysForCalculations > 0)
        {
            summary.AverageDailyFoodCaloriesKcal = summary.TotalFoodCaloriesKcal / daysForCalculations;
            summary.AverageDailyExpenditureKcal = summary.TotalExpenditureKcal / daysForCalculations;
            summary.AverageDailyBalanceKcal = summary.ActualMonthlyBalanceKcal / daysForCalculations;
            summary.AverageWeeklyBalanceKcal = summary.AverageDailyBalanceKcal * 7;
        }
        else
        {
            // Only today is logged - reset calculations to zero
            summary.AverageDailyFoodCaloriesKcal = 0;
            summary.AverageDailyExpenditureKcal = 0;
            summary.AverageDailyBalanceKcal = 0;
            summary.AverageWeeklyBalanceKcal = 0;
        }

        // 1 kg ≈ 7700 kcal
        summary.EstimatedWeightChangeKg = daysForCalculations > 0 
            ? summary.ActualMonthlyBalanceKcal / 7700m 
            : null;

        summary.LastCalculatedAtUtc = DateTime.UtcNow;
        summary.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();
    }
}
