using Articalorias.Models.Entities;

namespace Articalorias.Interfaces;

public interface IActivityService
{
    Task<IReadOnlyList<ActivityEntry>> GetEntriesByDailyLogAsync(long dailyLogId);
    /// <param name="providedCaloriesKcal">User-supplied burn (e.g. from a smart watch). When set, it is stored as-is and MET or duration is derived from it.</param>
    Task<ActivityEntry> CreateEntryAsync(ActivityEntry entry, decimal? providedCaloriesKcal = null);
    /// <param name="providedCaloriesKcal">User-supplied burn override. When set, it is stored as-is and the MET is re-derived.</param>
    Task<ActivityEntry> UpdateEntryAsync(ActivityEntry entry, decimal? providedCaloriesKcal = null);
    Task DeleteEntryAsync(long activityEntryId);

    Task<IReadOnlyList<ActivityTemplate>> GetTemplatesAsync(long? userId);
    Task<ActivityTemplate> CreateTemplateAsync(ActivityTemplate template);
    Task<ActivityTemplate?> UpdateTemplateAsync(ActivityTemplate template);
    Task<bool> DeleteTemplateAsync(long activityTemplateId, long userId);
}
