using Articalorias.Models.Entities;

namespace Articalorias.Interfaces;

public interface IMonthlySummaryService
{
    Task<MonthlySummary?> GetByMonthAsync(long userId, int year, int month);
    Task<IReadOnlyList<MonthlySummary>> GetByYearAsync(long userId, int year);
    Task RecalculateAsync(long userId, int year, int month);
}
