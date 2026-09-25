using Articalorias.Models.Entities;

namespace Articalorias.Interfaces;

public interface IFoodEntryService
{
    Task<IReadOnlyList<FoodEntry>> GetByDailyLogAsync(long dailyLogId);
    Task<FoodEntry> CreateAsync(FoodEntry entry);
    Task<IReadOnlyList<FoodEntry>> CreateBatchAsync(long dailyLogId, IReadOnlyList<FoodEntry> entries);
    /// <summary>
    /// Updates one entry the user owns. Returns null when the id does not
    /// exist or belongs to someone else (indistinguishable on purpose).
    /// </summary>
    Task<FoodEntry?> UpdateAsync(long userId, FoodEntry entry, bool scaleByQuantity = false);

    /// <summary>Deletes one entry the user owns. False when missing or foreign.</summary>
    Task<bool> DeleteAsync(long userId, long foodEntryId);

    /// <summary>
    /// Deletes the given entries of ONE day owned by the user in a single
    /// pass (one recalculation, one streak update). Ids that do not exist,
    /// belong to another user or sit on a different day are ignored.
    /// Returns the number of entries actually deleted.
    /// </summary>
    Task<int> DeleteBatchAsync(long userId, long dailyLogId, IReadOnlyList<long> foodEntryIds);
}
