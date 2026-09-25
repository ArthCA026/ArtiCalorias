using Articalorias.Models.Entities;

namespace Articalorias.Interfaces;

public interface IActivityService
{
    Task<IReadOnlyList<ActivityEntry>> GetEntriesByDailyLogAsync(long dailyLogId);
    /// <param name="userId">Owner of the day; a foreign <c>ActivityTemplateId</c> on the entry is rejected.</param>
    /// <param name="providedCaloriesKcal">User-supplied burn (e.g. from a smart watch). When set, it is stored as-is and MET or duration is derived from it.</param>
    Task<ActivityEntry> CreateEntryAsync(long userId, ActivityEntry entry, decimal? providedCaloriesKcal = null);
    /// <summary>Updates one entry the user owns. Null when missing or foreign.</summary>
    /// <param name="providedCaloriesKcal">User-supplied burn override. When set, it is stored as-is and the MET is re-derived.</param>
    Task<ActivityEntry?> UpdateEntryAsync(long userId, ActivityEntry entry, decimal? providedCaloriesKcal = null);
    /// <summary>Deletes one entry the user owns. False when missing or foreign.</summary>
    Task<bool> DeleteEntryAsync(long userId, long activityEntryId);

    /// <summary>
    /// Deletes the given entries of ONE day owned by the user in a single pass
    /// (one recalculation). Foreign or misplaced ids are ignored. Returns the
    /// number of entries actually deleted.
    /// </summary>
    Task<int> DeleteEntriesBatchAsync(long userId, long dailyLogId, IReadOnlyList<long> activityEntryIds);

    Task<IReadOnlyList<ActivityTemplate>> GetTemplatesAsync(long? userId);
    Task<ActivityTemplate> CreateTemplateAsync(ActivityTemplate template);
    Task<ActivityTemplate?> UpdateTemplateAsync(ActivityTemplate template);
    Task<bool> DeleteTemplateAsync(long activityTemplateId, long userId);
}
