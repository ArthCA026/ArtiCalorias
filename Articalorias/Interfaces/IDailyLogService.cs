using Articalorias.Models.Entities;

namespace Articalorias.Interfaces;

public interface IDailyLogService
{
    Task<DailyLog?> GetByDateAsync(long userId, DateOnly date);
    Task<DailyLog> GetOrCreateAsync(long userId, DateOnly date);
    Task<IReadOnlyList<DailyLog>> GetRangeAsync(long userId, DateOnly from, DateOnly to);
    Task RecalculateAsync(long dailyLogId);
}
