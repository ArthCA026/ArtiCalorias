using System.Security.Claims;
using Articalorias.DTOs.Activities;
using Articalorias.DTOs.ActivityParsing;
using Articalorias.DTOs.DailyLogs;
using Articalorias.DTOs.FoodEntries;
using Articalorias.DTOs.FoodParsing;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Articalorias.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DailyLogController : ControllerBase
{
    private readonly IDailyLogService _dailyLogService;
    private readonly IFoodEntryService _foodEntryService;
    private readonly IActivityService _activityService;
    private readonly IRecalculationService _recalculation;
    private readonly IFoodParsingService _foodParsing;
    private readonly IActivityParsingService _activityParsing;
    private readonly IUserProfileService _profileService;
    private readonly IFoodTemplateService _foodTemplateService;

    public DailyLogController(
        IDailyLogService dailyLogService,
        IFoodEntryService foodEntryService,
        IActivityService activityService,
        IRecalculationService recalculation,
        IFoodParsingService foodParsing,
        IActivityParsingService activityParsing,
        IUserProfileService profileService,
        IFoodTemplateService foodTemplateService)
    {
        _dailyLogService = dailyLogService;
        _foodEntryService = foodEntryService;
        _activityService = activityService;
        _recalculation = recalculation;
        _foodParsing = foodParsing;
        _activityParsing = activityParsing;
        _profileService = profileService;
        _foodTemplateService = foodTemplateService;
    }

    [HttpGet("{date}")]
    public async Task<IActionResult> GetByDate(DateOnly date)
    {
        var userId = GetUserId();
        var log = await _dailyLogService.GetOrCreateAsync(userId, date);
        return Ok(MapToResponse(log));
    }

    [HttpGet("{date}/dashboard")]
    public async Task<IActionResult> GetDashboard(DateOnly date)
    {
        var userId = GetUserId();
        var log = await _dailyLogService.GetOrCreateAsync(userId, date);

        var foods = await _foodEntryService.GetByDailyLogAsync(log.DailyLogId);
        var activities = await _activityService.GetEntriesByDailyLogAsync(log.DailyLogId);

        return Ok(MapToDashboard(log, foods, activities));
    }

    [HttpPost("{date}/recalculate")]
    public async Task<IActionResult> Recalculate(DateOnly date)
    {
        var userId = GetUserId();
        var log = await _dailyLogService.GetSummaryByDateAsync(userId, date);
        if (log is null)
            return NotFound();

        await _recalculation.RecalculateFullPipelineAsync(log.DailyLogId);
        log = await _dailyLogService.GetSummaryByDateAsync(userId, date);
        return Ok(MapToResponse(log!));
    }

    [HttpPost("{date}/refresh-snapshot")]
    public async Task<IActionResult> RefreshSnapshot(DateOnly date)
    {
        var userId = GetUserId();
        await _recalculation.RefreshSnapshotAndRecalculateAsync(userId, date);
        var log = await _dailyLogService.GetSummaryByDateAsync(userId, date);
        if (log is null)
            return NoContent(); // No log exists yet — nothing to return, not an error.
        return Ok(MapToResponse(log));
    }

    // ── AI food parsing (proposes entries, does NOT save) ──

    [HttpPost("{date}/parse-food")]
    public async Task<IActionResult> ParseFood(DateOnly date, [FromBody] ParseFoodRequest request)
    {
        var userId = GetUserId();
        var profile = await _profileService.GetByUserIdAsync(userId);
        var parsed = await _foodParsing.ParseFreeTextAsync(request.FreeText, profile?.Country);
        return Ok(parsed);
    }

    // ── AI vision food parsing — accepts a photo (+ optional text context) ──

    [HttpPost("{date}/parse-food-image")]
    public async Task<IActionResult> ParseFoodImage(DateOnly date, [FromBody] ParseFoodWithImageRequest request)
    {
        var userId = GetUserId();
        var profile = await _profileService.GetByUserIdAsync(userId);
        var parsed = await _foodParsing.ParseImageAsync(
            request.ImageBase64,
            request.MimeType,
            request.FreeText,
            profile?.Country);
        return Ok(parsed);
    }

    // ── Batch confirm (user reviewed AI proposals and hit confirm) ──

    [HttpPost("{date}/foods/batch")]
    public async Task<IActionResult> AddFoodBatch(DateOnly date, [FromBody] ConfirmParsedFoodsRequest request)
    {
        if (request.Items.Count == 0)
            return BadRequest("No items to confirm.");

        var userId = GetUserId();
        var log = await _dailyLogService.GetOrCreateAsync(userId, date);

        var entries = request.Items.Select(i => new FoodEntry
        {
            DailyLogId = log.DailyLogId,
            FoodName = i.FoodName,
            PortionDescription = i.PortionDescription,
            Quantity = i.Quantity,
            CaloriesKcal = i.CaloriesKcal,
            ProteinGrams = i.ProteinGrams,
            FatGrams = i.FatGrams,
            CarbsGrams = i.CarbsGrams,
            AlcoholGrams = i.AlcoholGrams,
            Notes = i.Notes
        }).ToList();

        var created = await _foodEntryService.CreateBatchAsync(log.DailyLogId, entries);
        return Ok(created.Select(MapFoodToResponse));
    }

    // ── AI activity parsing (proposes entries, does NOT save) ──

    [HttpPost("{date}/parse-activity")]
    public async Task<IActionResult> ParseActivity(DateOnly date, [FromBody] ParseActivityRequest request)
    {
        var parsed = await _activityParsing.ParseFreeTextAsync(request.FreeText);
        return Ok(parsed);
    }

    // ── Batch confirm activities (user reviewed AI proposals and hit confirm) ──

    [HttpPost("{date}/activities/batch")]
    public async Task<IActionResult> AddActivityBatch(DateOnly date, [FromBody] ConfirmParsedActivitiesRequest request)
    {
        if (request.Items.Count == 0)
            return BadRequest("No items to confirm.");

        var userId = GetUserId();
        var log = await _dailyLogService.GetOrCreateAsync(userId, date);

        var results = new List<ActivityEntryResponse>();

        foreach (var item in request.Items)
        {
            var entry = new ActivityEntry
            {
                DailyLogId = log.DailyLogId,
                ActivityTemplateId = item.ActivityTemplateId,
                ActivityName = item.ActivityName,
                DurationMinutes = item.DurationMinutes,
                METValue = item.METValue
            };

            var created = await _activityService.CreateEntryAsync(entry);
            results.Add(MapActivityToResponse(created));
        }

        return Ok(results);
    }

    // ── Food entries for a given day ──

    [HttpGet("{date}/foods")]
    public async Task<IActionResult> GetFoods(DateOnly date)
    {
        var userId = GetUserId();
        var log = await _dailyLogService.GetSummaryByDateAsync(userId, date);
        if (log is null)
            return Ok(Array.Empty<FoodEntryResponse>());

        var entries = await _foodEntryService.GetByDailyLogAsync(log.DailyLogId);
        return Ok(entries.Select(MapFoodToResponse));
    }

    [HttpPost("{date}/foods")]
    public async Task<IActionResult> AddFood(DateOnly date, [FromBody] CreateFoodEntryRequest request)
    {
        var userId = GetUserId();
        var log = await _dailyLogService.GetOrCreateAsync(userId, date);

        // Validate FoodTemplateId ownership if provided
        if (request.FoodTemplateId.HasValue)
        {
            var template = await _foodTemplateService.GetByIdAsync(request.FoodTemplateId.Value, userId);
            if (template is null)
                return BadRequest("Invalid FoodTemplateId.");
        }

        var entry = new FoodEntry
        {
            DailyLogId = log.DailyLogId,
            FoodName = request.FoodName,
            PortionDescription = request.PortionDescription,
            Quantity = request.Quantity,
            CaloriesKcal = request.CaloriesKcal,
            ProteinGrams = request.ProteinGrams,
            FatGrams = request.FatGrams,
            CarbsGrams = request.CarbsGrams,
            AlcoholGrams = request.AlcoholGrams,
            FoodTemplateId = request.FoodTemplateId,
            Notes = request.Notes
        };

        var created = await _foodEntryService.CreateAsync(entry);
        return Created($"/api/dailylog/{date}/foods/{created.FoodEntryId}", MapFoodToResponse(created));
    }

    [HttpPut("{date}/foods/{foodEntryId}")]
    public async Task<IActionResult> UpdateFood(DateOnly date, long foodEntryId, [FromBody] UpdateFoodEntryRequest request)
    {
        var entry = new FoodEntry
        {
            FoodEntryId = foodEntryId,
            FoodName = request.FoodName,
            PortionDescription = request.PortionDescription,
            Quantity = request.Quantity,
            CaloriesKcal = request.CaloriesKcal,
            ProteinGrams = request.ProteinGrams,
            FatGrams = request.FatGrams,
            CarbsGrams = request.CarbsGrams,
            AlcoholGrams = request.AlcoholGrams,
            Notes = request.Notes
        };

        var updated = await _foodEntryService.UpdateAsync(entry, request.ScaleByQuantity);
        return Ok(MapFoodToResponse(updated));
    }

    [HttpDelete("{date}/foods/{foodEntryId}")]
    public async Task<IActionResult> DeleteFood(DateOnly date, long foodEntryId)
    {
        await _foodEntryService.DeleteAsync(foodEntryId);
        return NoContent();
    }

    [HttpDelete("{date}")]
    public async Task<IActionResult> DeleteDay(DateOnly date)
    {
        var userId = GetUserId();
        await _dailyLogService.DeleteByDateAsync(userId, date);
        return NoContent();
    }

    // ── Helpers ──

    private long GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException();
        return long.Parse(claim.Value);
    }

    private static DailyLogResponse MapToResponse(DailyLog d) => new()
    {
        DailyLogId = d.DailyLogId,
        LogDate = d.LogDate,
        TotalFoodCaloriesKcal = d.TotalFoodCaloriesKcal,
        TotalProteinGrams = d.TotalProteinGrams,
        TotalDailyExpenditureKcal = d.TotalDailyExpenditureKcal,
        DailyGoalDeltaKcal = d.DailyGoalDeltaKcal,
        CaloriesRemainingToDailyTargetKcal = d.CaloriesRemainingToDailyTargetKcal,
        ProteinRemainingGrams = d.ProteinRemainingGrams,
        SuggestedDailyAverageRemainingKcal = d.SuggestedDailyAverageRemainingKcal,
        SnapshotProteinGoalGrams = d.SnapshotProteinGoalGrams
    };

    private static FoodEntryResponse MapFoodToResponse(FoodEntry f) => new()
    {
        FoodEntryId = f.FoodEntryId,
        FoodName = f.FoodName,
        PortionDescription = f.PortionDescription,
        Quantity = f.Quantity,
        CaloriesKcal = f.CaloriesKcal,
        ProteinGrams = f.ProteinGrams,
        FatGrams = f.FatGrams,
        CarbsGrams = f.CarbsGrams,
        AlcoholGrams = f.AlcoholGrams,
        SortOrder = f.SortOrder,
        Notes = f.Notes
    };

    private static ActivityEntryResponse MapActivityToResponse(ActivityEntry a) => new()
    {
        ActivityEntryId = a.ActivityEntryId,
        ActivityTemplateId = a.ActivityTemplateId,
        ActivityName = a.ActivityName,
        DurationMinutes = a.DurationMinutes,
        METValue = a.METValue,
        CalculatedCaloriesKcal = a.CalculatedCaloriesKcal,
        SortOrder = a.SortOrder
    };

    private static DailyDashboardResponse MapToDashboard(
        DailyLog d,
        IReadOnlyList<FoodEntry> foods,
        IReadOnlyList<ActivityEntry> activities) => new()
    {
        DailyLogId = d.DailyLogId,
        LogDate = d.LogDate,
        TotalFoodCaloriesKcal = d.TotalFoodCaloriesKcal,
        TotalProteinGrams = d.TotalProteinGrams,
        TotalDailyExpenditureKcal = d.TotalDailyExpenditureKcal,
        DailyGoalDeltaKcal = d.DailyGoalDeltaKcal,
        CaloriesRemainingToDailyTargetKcal = d.CaloriesRemainingToDailyTargetKcal,
        ProteinRemainingGrams = d.ProteinRemainingGrams,
        SuggestedDailyAverageRemainingKcal = d.SuggestedDailyAverageRemainingKcal,
        SnapshotProteinGoalGrams = d.SnapshotProteinGoalGrams,
        FoodEntries = foods.Select(MapFoodToResponse).ToList(),
        ActivityEntries = activities.Select(MapActivityToResponse).ToList(),
        SleepCaloriesKcal = d.SleepCaloriesKcal,
        NeatCaloriesKcal = d.NeatCaloriesKcal,
        SnapshotSleepHours = d.SnapshotSleepHours,
        SnapshotNeatHours = d.SnapshotNeatHours,
    };
}
