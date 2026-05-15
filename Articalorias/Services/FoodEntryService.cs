using System.Text.RegularExpressions;
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
            .AsNoTracking()
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

    public async Task<FoodEntry> UpdateAsync(FoodEntry entry, bool scaleByQuantity = false)
    {
        var existing = await _db.FoodEntries.FindAsync(entry.FoodEntryId)
            ?? throw new InvalidOperationException("FoodEntry not found.");

        var oldQuantity = existing.Quantity;

        existing.FoodName = entry.FoodName;
        existing.PortionDescription = NormalizePortionDescription(entry.PortionDescription);
        existing.Quantity = entry.Quantity;
        existing.Notes = entry.Notes;

        if (scaleByQuantity
            && entry.Quantity.HasValue
            && oldQuantity.HasValue
            && oldQuantity.Value != 0m)
        {
            var ratio = entry.Quantity.Value / oldQuantity.Value;
            existing.CaloriesKcal = Math.Round(existing.CaloriesKcal * ratio, 2);
            existing.ProteinGrams = Math.Round(existing.ProteinGrams * ratio, 2);
            existing.FatGrams = Math.Round(existing.FatGrams * ratio, 2);
            existing.CarbsGrams = Math.Round(existing.CarbsGrams * ratio, 2);
            existing.AlcoholGrams = Math.Round(existing.AlcoholGrams * ratio, 2);
        }
        else
        {
            existing.CaloriesKcal = entry.CaloriesKcal;
            existing.ProteinGrams = entry.ProteinGrams;
            existing.FatGrams = entry.FatGrams;
            existing.CarbsGrams = entry.CarbsGrams;
            existing.AlcoholGrams = entry.AlcoholGrams;
        }

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

    private static readonly Regex LeadingOnePattern = new(@"^1\s+", RegexOptions.Compiled);

    private static string? NormalizePortionDescription(string? s)
        => string.IsNullOrWhiteSpace(s) ? s : LeadingOnePattern.Replace(s, string.Empty);
}
