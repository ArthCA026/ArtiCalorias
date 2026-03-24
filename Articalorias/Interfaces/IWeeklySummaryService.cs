using Articalorias.Models.Entities;

namespace Articalorias.Interfaces;

public interface IWeeklySummaryService
{
    Task<WeeklySummary?> GetByWeekAsync(long userId, DateOnly weekStartDate);
    Task<IReadOnlyList<WeeklySummary>> GetRangeAsync(long userId, DateOnly from, DateOnly to);
    Task RecalculateAsync(long userId, DateOnly weekStartDate);
}
