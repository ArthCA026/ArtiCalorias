using Articalorias.Data;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Services;

public class FoodTemplateService : IFoodTemplateService
{
    private readonly AppDbContext _db;

    public FoodTemplateService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<FoodTemplate>> GetByUserAsync(long userId, CancellationToken ct = default)
    {
        return await _db.FoodTemplates
            .AsNoTracking()
            .Where(f => f.UserId == userId && f.IsActive)
            .OrderBy(f => f.TemplateName)
            .ToListAsync(ct);
    }

    public async Task<FoodTemplate?> GetByIdAsync(long id, long userId, CancellationToken ct = default)
    {
        return await _db.FoodTemplates
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.FoodTemplateId == id && f.UserId == userId && f.IsActive, ct);
    }

    public async Task<FoodTemplate> CreateAsync(FoodTemplate template, CancellationToken ct = default)
    {
        template.IsActive = true;
        template.CreatedAtUtc = DateTime.UtcNow;
        template.UpdatedAtUtc = DateTime.UtcNow;
        _db.FoodTemplates.Add(template);
        await _db.SaveChangesAsync(ct);
        return template;
    }

    public async Task<FoodTemplate?> UpdateAsync(FoodTemplate template, CancellationToken ct = default)
    {
        var existing = await _db.FoodTemplates
            .FirstOrDefaultAsync(f => f.FoodTemplateId == template.FoodTemplateId && f.UserId == template.UserId && f.IsActive, ct);

        if (existing is null)
            return null;

        existing.TemplateName = template.TemplateName;
        existing.PortionDescription = template.PortionDescription;
        existing.DefaultQuantity = template.DefaultQuantity;
        existing.CaloriesKcal = template.CaloriesKcal;
        existing.ProteinGrams = template.ProteinGrams;
        existing.FatGrams = template.FatGrams;
        existing.CarbsGrams = template.CarbsGrams;
        existing.AlcoholGrams = template.AlcoholGrams;
        existing.AutoAddToNewDay = template.AutoAddToNewDay;
        existing.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return existing;
    }

    public async Task<bool> DeleteAsync(long id, long userId, CancellationToken ct = default)
    {
        var existing = await _db.FoodTemplates
            .FirstOrDefaultAsync(f => f.FoodTemplateId == id && f.UserId == userId && f.IsActive, ct);

        if (existing is null)
            return false;

        existing.IsActive = false;
        existing.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<IReadOnlyList<FoodTemplate>> GetAutoAddTemplatesAsync(long userId, CancellationToken ct = default)
    {
        return await _db.FoodTemplates
            .AsNoTracking()
            .Where(f => f.UserId == userId && f.IsActive && f.AutoAddToNewDay)
            .ToListAsync(ct);
    }
}
