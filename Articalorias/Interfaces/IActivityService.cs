using Articalorias.Models.Entities;

namespace Articalorias.Interfaces;

public interface IActivityService
{
    Task<IReadOnlyList<ActivityEntry>> GetEntriesByDailyLogAsync(long dailyLogId);
    Task<ActivityEntry> CreateEntryAsync(ActivityEntry entry);
    Task<ActivityEntry> UpdateEntryAsync(ActivityEntry entry);
    Task DeleteEntryAsync(long activityEntryId);

    Task<IReadOnlyList<ActivityTemplate>> GetTemplatesAsync(long? userId);
    Task<ActivityTemplate> CreateTemplateAsync(ActivityTemplate template);
    Task<ActivityTemplate> UpdateTemplateAsync(ActivityTemplate template);
    Task DeleteTemplateAsync(long activityTemplateId);
}
