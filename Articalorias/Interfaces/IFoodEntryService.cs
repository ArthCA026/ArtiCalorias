using Articalorias.Models.Entities;

namespace Articalorias.Interfaces;

public interface IFoodEntryService
{
    Task<IReadOnlyList<FoodEntry>> GetByDailyLogAsync(long dailyLogId);
    Task<FoodEntry> CreateAsync(FoodEntry entry);
    Task<IReadOnlyList<FoodEntry>> CreateBatchAsync(long dailyLogId, IReadOnlyList<FoodEntry> entries);
    Task<FoodEntry> UpdateAsync(FoodEntry entry, bool scaleByQuantity = false);
    Task DeleteAsync(long foodEntryId);

    /// <summary>
    /// Deletes the given entries of ONE day owned by the user in a single
    /// pass (one recalculation, one streak update). Ids that do not exist,
    /// belong to another user or sit on a different day are ignored.
    /// Returns the number of entries actually deleted.
    /// </summary>
    Task<int> DeleteBatchAsync(long userId, long dailyLogId, IReadOnlyList<long> foodEntryIds);
}
