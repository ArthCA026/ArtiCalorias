using Articalorias.Data;
using Articalorias.DTOs.Favorites;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Services;

public class FavoriteRoutineService : IFavoriteRoutineService
{
    private readonly AppDbContext _db;
    private readonly IDailyLogService _dailyLogService;
    private readonly IRecalculationService _recalculation;
    private readonly IStreakService _streak;

    public FavoriteRoutineService(AppDbContext db, IDailyLogService dailyLogService, IRecalculationService recalculation, IStreakService streak)
    {
        _db = db;
        _dailyLogService = dailyLogService;
        _recalculation = recalculation;
        _streak = streak;
    }

    public async Task<IReadOnlyList<FavoriteRoutine>> GetByUserAsync(long userId, CancellationToken ct = default)
    {
        return await _db.FavoriteRoutines
            .AsNoTracking()
            .Where(r => r.UserId == userId && r.IsActive)
            .Include(r => r.Items.OrderBy(i => i.SortOrder))
                .ThenInclude(i => i.ActivityTemplate)
            .Include(r => r.Items.OrderBy(i => i.SortOrder))
                .ThenInclude(i => i.FoodTemplate)
            .OrderBy(r => r.SortOrder)
            .ToListAsync(ct);
    }

    public async Task<FavoriteRoutine?> GetByIdAsync(long id, long userId, CancellationToken ct = default)
    {
        return await _db.FavoriteRoutines
            .AsNoTracking()
            .Where(r => r.FavoriteRoutineId == id && r.UserId == userId && r.IsActive)
            .Include(r => r.Items.OrderBy(i => i.SortOrder))
                .ThenInclude(i => i.ActivityTemplate)
            .Include(r => r.Items.OrderBy(i => i.SortOrder))
                .ThenInclude(i => i.FoodTemplate)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<FavoriteRoutine> CreateAsync(FavoriteRoutine routine, List<FavoriteRoutineItem> items, CancellationToken ct = default)
    {
        routine.IsActive = true;
        routine.CreatedAtUtc = DateTime.UtcNow;
        routine.UpdatedAtUtc = DateTime.UtcNow;
        _db.FavoriteRoutines.Add(routine);
        await _db.SaveChangesAsync(ct);

        foreach (var item in items)
        {
            item.FavoriteRoutineId = routine.FavoriteRoutineId;
            _db.FavoriteRoutineItems.Add(item);
        }
        await _db.SaveChangesAsync(ct);
        return routine;
    }

    public async Task<FavoriteRoutine?> UpdateAsync(FavoriteRoutine routine, List<FavoriteRoutineItem> items, CancellationToken ct = default)
    {
        var existing = await _db.FavoriteRoutines
            .Include(r => r.Items)
            .FirstOrDefaultAsync(r => r.FavoriteRoutineId == routine.FavoriteRoutineId && r.UserId == routine.UserId && r.IsActive, ct);

        if (existing is null)
            return null;

        existing.RoutineName = routine.RoutineName;
        existing.UpdatedAtUtc = DateTime.UtcNow;

        // Replace items
        _db.FavoriteRoutineItems.RemoveRange(existing.Items);
        foreach (var item in items)
        {
            item.FavoriteRoutineId = existing.FavoriteRoutineId;
            _db.FavoriteRoutineItems.Add(item);
        }

        await _db.SaveChangesAsync(ct);
        return existing;
    }

    public async Task<bool> DeleteAsync(long id, long userId, CancellationToken ct = default)
    {
        var existing = await _db.FavoriteRoutines
            .FirstOrDefaultAsync(r => r.FavoriteRoutineId == id && r.UserId == userId && r.IsActive, ct);

        if (existing is null)
            return false;

        existing.IsActive = false;
        existing.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<AddRoutineToTodayResponse> AddRoutineToTodayAsync(long routineId, long userId, DateOnly today, CancellationToken ct = default)
    {
        var routine = await _db.FavoriteRoutines
            .Where(r => r.FavoriteRoutineId == routineId && r.UserId == userId && r.IsActive)
            .Include(r => r.Items.OrderBy(i => i.SortOrder))
                .ThenInclude(i => i.ActivityTemplate)
            .Include(r => r.Items.OrderBy(i => i.SortOrder))
                .ThenInclude(i => i.FoodTemplate)
            .FirstOrDefaultAsync(ct)
            ?? throw new InvalidOperationException("Routine not found.");

        var log = await _dailyLogService.GetOrCreateAsync(userId, today);

        var addedCount = 0;
        var addedFood = false;
        var skippedItems = new List<SkippedRoutineItem>();

        var maxFoodSort = await _db.FoodEntries
            .Where(f => f.DailyLogId == log.DailyLogId)
            .MaxAsync(f => (int?)f.SortOrder, ct) ?? 0;

        var maxActivitySort = await _db.ActivityEntries
            .Where(a => a.DailyLogId == log.DailyLogId)
            .MaxAsync(a => (int?)a.SortOrder, ct) ?? 0;

        foreach (var item in routine.Items.OrderBy(i => i.SortOrder))
        {
            if (item.ItemType == "activity")
            {
                if (item.ActivityTemplate is null || !item.ActivityTemplate.IsActive)
                {
                    skippedItems.Add(new SkippedRoutineItem { FavoriteRoutineItemId = item.FavoriteRoutineItemId, Reason = "Template was deleted" });
                    continue;
                }

                // Same weight source as every other entry calculation: the day's own
                // snapshot. Keeps the gross calories consistent with the day-level
                // resting offset in RecalculationService.
                var weight = log.SnapshotWeightKg ?? 0m;

                var entry = new ActivityEntry
                {
                    DailyLogId = log.DailyLogId,
                    ActivityTemplateId = item.ActivityTemplate.ActivityTemplateId,
                    ActivityName = item.ActivityTemplate.TemplateName,
                    DurationMinutes = item.ActivityTemplate.DefaultDurationMinutes,
                    METValue = item.ActivityTemplate.DefaultMET,
                    SortOrder = ++maxActivitySort,
                };

                ActivityCalorieMath.Apply(entry, weight, providedCaloriesKcal: null);

                _db.ActivityEntries.Add(entry);
                addedCount++;
            }
            else if (item.ItemType == "food")
            {
                if (item.FoodTemplate is null || !item.FoodTemplate.IsActive)
                {
                    skippedItems.Add(new SkippedRoutineItem { FavoriteRoutineItemId = item.FavoriteRoutineItemId, Reason = "Template was deleted" });
                    continue;
                }

                _db.FoodEntries.Add(FoodTemplateMath.ToEntry(item.FoodTemplate, log.DailyLogId, ++maxFoodSort));
                addedFood = true;
                addedCount++;
            }
            else
            {
                skippedItems.Add(new SkippedRoutineItem { FavoriteRoutineItemId = item.FavoriteRoutineItemId, Reason = "Unknown item type" });
            }
        }

        await _db.SaveChangesAsync(ct);
        await _recalculation.RecalculateFullPipelineAsync(log.DailyLogId);

        // A quick-added routine is the user logging food: the streak and the
        // first-log flag must move exactly as they do for a manual entry.
        if (addedFood)
        {
            await _streak.RecalculateForUserAsync(userId, ct);

            var profile = await _db.UserProfiles.FirstOrDefaultAsync(p => p.UserId == userId, ct);
            if (profile is not null && !profile.FirstFoodLoggedAtUtc.HasValue)
            {
                profile.FirstFoodLoggedAtUtc = DateTime.UtcNow;
                await _db.SaveChangesAsync(ct);
            }
        }

        return new AddRoutineToTodayResponse
        {
            AddedCount = addedCount,
            SkippedItems = skippedItems,
        };
    }

    public async Task<IReadOnlyList<string>> GetRoutineNamesByFoodTemplateAsync(long foodTemplateId, long userId, CancellationToken ct = default)
    {
        return await _db.FavoriteRoutineItems
            .AsNoTracking()
            .Where(i => i.FoodTemplateId == foodTemplateId
                     && i.Routine.UserId == userId
                     && i.Routine.IsActive)
            .Select(i => i.Routine.RoutineName)
            .Distinct()
            .OrderBy(n => n)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<string>> GetRoutineNamesByActivityTemplateAsync(long activityTemplateId, long userId, CancellationToken ct = default)
    {
        return await _db.FavoriteRoutineItems
            .AsNoTracking()
            .Where(i => i.ActivityTemplateId == activityTemplateId
                     && i.Routine.UserId == userId
                     && i.Routine.IsActive)
            .Select(i => i.Routine.RoutineName)
            .Distinct()
            .OrderBy(n => n)
            .ToListAsync(ct);
    }

    public async Task RemoveItemsByFoodTemplateAsync(long foodTemplateId, long userId, CancellationToken ct = default)
    {
        var items = await _db.FavoriteRoutineItems
            .Where(i => i.FoodTemplateId == foodTemplateId
                     && i.Routine.UserId == userId
                     && i.Routine.IsActive)
            .ToListAsync(ct);
        if (items.Count == 0) return;
        _db.FavoriteRoutineItems.RemoveRange(items);
        await _db.SaveChangesAsync(ct);
    }

    public async Task RemoveItemsByActivityTemplateAsync(long activityTemplateId, long userId, CancellationToken ct = default)
    {
        var items = await _db.FavoriteRoutineItems
            .Where(i => i.ActivityTemplateId == activityTemplateId
                     && i.Routine.UserId == userId
                     && i.Routine.IsActive)
            .ToListAsync(ct);
        if (items.Count == 0) return;
        _db.FavoriteRoutineItems.RemoveRange(items);
        await _db.SaveChangesAsync(ct);
    }
}
