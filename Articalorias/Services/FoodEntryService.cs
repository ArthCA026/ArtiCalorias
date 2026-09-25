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
    private readonly IStreakService _streak;

    public FoodEntryService(AppDbContext db, IRecalculationService recalculation, IStreakService streak)
    {
        _db = db;
        _recalculation = recalculation;
        _streak = streak;
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

        var userId = await GetUserIdForLogAsync(entry.DailyLogId);
        await _streak.RecalculateForUserAsync(userId);
        await MarkFirstFoodLoggedAsync(userId);

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

        var userId = await GetUserIdForLogAsync(dailyLogId);
        await _streak.RecalculateForUserAsync(userId);
        await MarkFirstFoodLoggedAsync(userId);

        return entries;
    }

    /// <summary>
    /// Stamps the user's first-ever own food log (once). Auto-added template
    /// meals never reach this path on purpose: the getting-started checklist
    /// keeps nudging until the user logs something THEMSELF.
    /// </summary>
    private async Task MarkFirstFoodLoggedAsync(long userId)
    {
        var profile = await _db.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (profile is null || profile.FirstFoodLoggedAtUtc.HasValue)
            return;
        profile.FirstFoodLoggedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync();
    }

    public async Task<FoodEntry?> UpdateAsync(long userId, FoodEntry entry, bool scaleByQuantity = false)
    {
        // Ownership lives in the query itself: a foreign id looks exactly like
        // a missing one, so nothing can be edited or even confirmed to exist.
        var existing = await _db.FoodEntries
            .FirstOrDefaultAsync(f => f.FoodEntryId == entry.FoodEntryId && f.DailyLog.UserId == userId);
        if (existing is null)
            return null;

        var oldDailyLogId = existing.DailyLogId;
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
            // Every stored macro scales with the quantity; absent keys stay absent.
            var ratio = entry.Quantity.Value / oldQuantity.Value;
            existing.CaloriesKcal = Math.Round(existing.CaloriesKcal * ratio, 2);
            existing.Macros = existing.Macros.Scale(ratio, 2);
        }
        else
        {
            existing.CaloriesKcal = entry.CaloriesKcal;
            existing.Macros = entry.Macros;
        }

        existing.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        await _recalculation.RecalculateFullPipelineAsync(existing.DailyLogId);

        // Recalculate streak when the entry was moved to a different date (DailyLogId changed).
        var dateChanged = existing.DailyLogId != oldDailyLogId;
        if (dateChanged)
            await _streak.RecalculateForUserAsync(userId);

        return existing;
    }

    public async Task<bool> DeleteAsync(long userId, long foodEntryId)
    {
        var entry = await _db.FoodEntries
            .FirstOrDefaultAsync(f => f.FoodEntryId == foodEntryId && f.DailyLog.UserId == userId);
        if (entry is null)
            return false;

        var dailyLogId = entry.DailyLogId;
        _db.FoodEntries.Remove(entry);
        await _db.SaveChangesAsync();

        await _recalculation.RecalculateFullPipelineAsync(dailyLogId);
        await _streak.RecalculateForUserAsync(userId);
        return true;
    }

    public async Task<int> DeleteBatchAsync(long userId, long dailyLogId, IReadOnlyList<long> foodEntryIds)
    {
        if (foodEntryIds.Count == 0)
            return 0;

        // Ownership and same-day scoping in the query itself: a foreign or
        // misplaced id silently drops out instead of deleting someone's data.
        var entries = await _db.FoodEntries
            .Where(f => foodEntryIds.Contains(f.FoodEntryId)
                && f.DailyLogId == dailyLogId
                && f.DailyLog.UserId == userId)
            .ToListAsync();

        if (entries.Count == 0)
            return 0;

        _db.FoodEntries.RemoveRange(entries);
        await _db.SaveChangesAsync();

        // One pipeline pass for the whole batch, exactly like batch create.
        await _recalculation.RecalculateFullPipelineAsync(dailyLogId);
        await _streak.RecalculateForUserAsync(userId);

        return entries.Count;
    }

    private async Task<long> GetUserIdForLogAsync(long dailyLogId) =>
        await _db.DailyLogs
            .AsNoTracking()
            .Where(dl => dl.DailyLogId == dailyLogId)
            .Select(dl => dl.UserId)
            .FirstAsync();

    private static readonly Regex LeadingOnePattern = new(@"^1\s+", RegexOptions.Compiled);

    private static string? NormalizePortionDescription(string? s)
        => string.IsNullOrWhiteSpace(s) ? s : LeadingOnePattern.Replace(s, string.Empty);
}
