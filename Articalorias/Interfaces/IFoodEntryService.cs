using Articalorias.Models.Entities;

namespace Articalorias.Interfaces;

public interface IFoodEntryService
{
    Task<IReadOnlyList<FoodEntry>> GetByDailyLogAsync(long dailyLogId);
    Task<FoodEntry> CreateAsync(FoodEntry entry);
    Task<IReadOnlyList<FoodEntry>> CreateBatchAsync(long dailyLogId, IReadOnlyList<FoodEntry> entries);
    Task<FoodEntry> UpdateAsync(FoodEntry entry);
    Task DeleteAsync(long foodEntryId);
}
