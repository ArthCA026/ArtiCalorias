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

        summary.MonthStartDate = monthStart;
        summary.MonthEndDate = monthEnd;
        summary.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();
    }
}
