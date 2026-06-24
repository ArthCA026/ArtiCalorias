using Articalorias.DTOs.Favorites;
using Articalorias.Models.Entities;

namespace Articalorias.Interfaces;

public interface IFavoriteRoutineService
{
    Task<IReadOnlyList<FavoriteRoutine>> GetByUserAsync(long userId, CancellationToken ct = default);
    Task<FavoriteRoutine?> GetByIdAsync(long id, long userId, CancellationToken ct = default);
    Task<FavoriteRoutine> CreateAsync(FavoriteRoutine routine, List<FavoriteRoutineItem> items, CancellationToken ct = default);
    Task<FavoriteRoutine?> UpdateAsync(FavoriteRoutine routine, List<FavoriteRoutineItem> items, CancellationToken ct = default);
    Task<bool> DeleteAsync(long id, long userId, CancellationToken ct = default);
    Task<AddRoutineToTodayResponse> AddRoutineToTodayAsync(long routineId, long userId, DateOnly today, CancellationToken ct = default);
    Task<IReadOnlyList<string>> GetRoutineNamesByFoodTemplateAsync(long foodTemplateId, long userId, CancellationToken ct = default);
    Task<IReadOnlyList<string>> GetRoutineNamesByActivityTemplateAsync(long activityTemplateId, long userId, CancellationToken ct = default);
    Task RemoveItemsByFoodTemplateAsync(long foodTemplateId, long userId, CancellationToken ct = default);
    Task RemoveItemsByActivityTemplateAsync(long activityTemplateId, long userId, CancellationToken ct = default);
}
