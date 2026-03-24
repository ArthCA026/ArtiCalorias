using Articalorias.Data;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Services;

public class FoodEntryService : IFoodEntryService
{
    private readonly AppDbContext _db;
    private readonly IRecalculationService _recalculation;

    public FoodEntryService(AppDbContext db, IRecalculationService recalculation)
    {
        _db = db;
        _recalculation = recalculation;
    }

    public async Task<IReadOnlyList<FoodEntry>> GetByDailyLogAsync(long dailyLogId)
    {
        return await _db.FoodEntries
            .Where(f => f.DailyLogId == dailyLogId)
            .OrderBy(f => f.SortOrder)
            .ToListAsync();
    }

    public async Task<FoodEntry> CreateAsync(FoodEntry entry)
    {
        var maxSort = await _db.FoodEntries
            .Where(f => f.DailyLogId == entry.DailyLogId)
            .MaxAsync(f => (int?)f.SortOrder) ?? 0;
        entry.SortOrder = maxSort + 1;

        _db.FoodEntries.Add(entry);
        await _db.SaveChangesAsync();

        await _recalculation.RecalculateFullPipelineAsync(entry.DailyLogId);
        return entry;
    }

    public async Task<IReadOnlyList<FoodEntry>> CreateBatchAsync(long dailyLogId, IReadOnlyList<FoodEntry> entries)
    {
        if (entries.Count == 0)
            return [];

        var maxSort = await _db.FoodEntries
            .Where(f => f.DailyLogId == dailyLogId)
            .MaxAsync(f => (int?)f.SortOrder) ?? 0;

        foreach (var entry in entries)
        {
            entry.DailyLogId = dailyLogId;
            entry.SortOrder = ++maxSort;
            _db.FoodEntries.Add(entry);
        }

        await _db.SaveChangesAsync();

        // Single recalculation for the entire batch
        await _recalculation.RecalculateFullPipelineAsync(dailyLogId);

        return entries;
    }

    public async Task<FoodEntry> UpdateAsync(FoodEntry entry)
    {
        var existing = await _db.FoodEntries.FindAsync(entry.FoodEntryId)
            ?? throw new InvalidOperationException("FoodEntry not found.");

        existing.FoodName = entry.FoodName;
        existing.PortionDescription = entry.PortionDescription;
        existing.Quantity = entry.Quantity;
        existing.Unit = entry.Unit;
        existing.CaloriesKcal = entry.CaloriesKcal;
        existing.ProteinGrams = entry.ProteinGrams;
        existing.FatGrams = entry.FatGrams;
        existing.CarbsGrams = entry.CarbsGrams;
        existing.AlcoholGrams = entry.AlcoholGrams;
        existing.Notes = entry.Notes;
        existing.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        await _recalculation.RecalculateFullPipelineAsync(existing.DailyLogId);
        return existing;
    }

    public async Task DeleteAsync(long foodEntryId)
    {
        var entry = await _db.FoodEntries.FindAsync(foodEntryId)
            ?? throw new InvalidOperationException("FoodEntry not found.");

        var dailyLogId = entry.DailyLogId;
        _db.FoodEntries.Remove(entry);
        await _db.SaveChangesAsync();

        await _recalculation.RecalculateFullPipelineAsync(dailyLogId);
    }
}
