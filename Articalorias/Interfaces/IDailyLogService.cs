using Articalorias.Models.Entities;

namespace Articalorias.Interfaces;

public interface IDailyLogService
{
    /// <summary>Returns the DailyLog header only (no food/activity JOINs).</summary>
    Task<DailyLog?> GetSummaryByDateAsync(long userId, DateOnly date);
    /// <summary>Returns the DailyLog with FoodEntries, ActivityEntries, and Segments included.</summary>
    Task<DailyLog?> GetByDateAsync(long userId, DateOnly date);
    /// <summary>
    /// Returns the day, creating it on first request. <paramref name="clientToday"/>
    /// is the device's local calendar date when the caller knows it; it decides
    /// whether <paramref name="date"/> is the user's today (routine auto-add)
    /// ahead of the stored profile timezone. See <see cref="Services.LocalDates.Resolve"/>.
    /// </summary>
    Task<DailyLog> GetOrCreateAsync(long userId, DateOnly date, DateOnly? clientToday = null);
    Task<IReadOnlyList<DailyLog>> GetRangeAsync(long userId, DateOnly from, DateOnly to);
    Task RecalculateAsync(long dailyLogId);
    Task DeleteByDateAsync(long userId, DateOnly date);

    /// <summary>
    /// Marks or unmarks a day as a deliberate fasting day. Creates the day row
    /// if needed. Rejects marking a day that has food entries. Recalculates the
    /// week (using <paramref name="referenceToday"/> as the freeze reference so
    /// the user's real today receives the banked balance) and the streak.
    /// </summary>
    Task<DailyLog> SetFastingAsync(long userId, DateOnly date, bool isFasting, DateOnly referenceToday);
}
