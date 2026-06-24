using Articalorias.Models.Entities;

namespace Articalorias.Interfaces;

public interface IFoodTemplateService
{
    Task<IReadOnlyList<FoodTemplate>> GetByUserAsync(long userId, CancellationToken ct = default);
    Task<FoodTemplate?> GetByIdAsync(long id, long userId, CancellationToken ct = default);
    Task<FoodTemplate> CreateAsync(FoodTemplate template, CancellationToken ct = default);
    Task<FoodTemplate?> UpdateAsync(FoodTemplate template, CancellationToken ct = default);
    Task<bool> DeleteAsync(long id, long userId, CancellationToken ct = default);
    Task<IReadOnlyList<FoodTemplate>> GetAutoAddTemplatesAsync(long userId, CancellationToken ct = default);
}
