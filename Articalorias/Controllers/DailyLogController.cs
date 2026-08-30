using System.Security.Claims;
using Articalorias.DTOs.Activities;
using Articalorias.DTOs.ActivityParsing;
using Articalorias.DTOs.DailyLogs;
using Articalorias.DTOs.FoodEntries;
using Articalorias.DTOs.FoodParsing;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Articalorias.Services;
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
    private readonly IMacroPreferenceService _macroPreferences;

    public DailyLogController(
        IDailyLogService dailyLogService,
        IFoodEntryService foodEntryService,
        IActivityService activityService,
        IRecalculationService recalculation,
        IFoodParsingService foodParsing,
        IActivityParsingService activityParsing,
        IUserProfileService profileService,
        IFoodTemplateService foodTemplateService,
        IMacroPreferenceService macroPreferences)
    {
        _dailyLogService = dailyLogService;
        _foodEntryService = foodEntryService;
        _activityService = activityService;
        _recalculation = recalculation;
        _foodParsing = foodParsing;
        _activityParsing = activityParsing;
        _profileService = profileService;
        _foodTemplateService = foodTemplateService;
        _macroPreferences = macroPreferences;
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

        // Self-heal: the stored day totals can drift from the entries after an
        // out-of-band data repair (SQL fix scripts touch entries but cannot run
        // the pipeline). Totals and entries share decimal(10,2), so equality is
        // exact whenever the pipeline last ran; a mismatch means drift and the
        // day (plus its week) trues itself up once on view.
        if (log.TotalFoodCaloriesKcal != foods.Sum(f => f.CaloriesKcal)
            || log.TotalActivityCaloriesKcal != activities.Sum(a => a.CalculatedCaloriesKcal))
        {
            await _recalculation.RecalculateFullPipelineAsync(log.DailyLogId);
            log = (await _dailyLogService.GetSummaryByDateAsync(userId, date))!;
        }

        var profile = await _profileService.GetByUserIdAsync(userId);

        return Ok(MapToDashboard(log, foods, activities, profile?.FirstFoodLoggedAtUtc.HasValue ?? false));
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

    /// <summary>
    /// Marks or unmarks a day as a deliberate fasting day. The optional
    /// <paramref name="today"/> query param carries the client's local date so
    /// budgets and the freeze rule work on the user's calendar, not UTC's.
    /// </summary>
    [HttpPut("{date}/fasting")]
    public async Task<IActionResult> SetFasting(DateOnly date, [FromBody] SetFastingRequest request, [FromQuery] DateOnly? today)
    {
        var userId = GetUserId();

        // Same local-date resolution as the routines quick-add: trust the
        // client's calendar date within a ±2 day sanity window around UTC now,
        // otherwise fall back to the stored profile timezone (then UTC).
        var utcToday = DateOnly.FromDateTime(DateTime.UtcNow);
        DateOnly localToday;
        if (today.HasValue && Math.Abs(today.Value.DayNumber - utcToday.DayNumber) <= 2)
        {
            localToday = today.Value;
        }
        else
        {
            var profile = await _profileService.GetByUserIdAsync(userId);
            TimeZoneInfo tz;
            try   { tz = TimeZoneInfo.FindSystemTimeZoneById(profile?.TimeZoneId ?? "UTC"); }
            catch (TimeZoneNotFoundException) { tz = TimeZoneInfo.Utc; }
            catch (InvalidTimeZoneException)  { tz = TimeZoneInfo.Utc; }
            localToday = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz));
        }

        if (date > localToday)
            return BadRequest(new { Message = "A future day cannot be marked as a fasting day." });

        var log = await _dailyLogService.SetFastingAsync(userId, date, request.IsFasting, localToday);
        return Ok(MapToResponse(log));
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

    /// <summary>
    /// Refreshes profile snapshots on every DailyLog that was created when the
    /// user's weight or height was missing.  Called after a profile save so that
    /// historical entries stop showing "Missing profile details".
    /// </summary>
    [HttpPost("refresh-stale-snapshots")]
    public async Task<IActionResult> RefreshStaleSnapshots(CancellationToken ct)
    {
        var userId = GetUserId();
        var count = await _recalculation.RefreshStaleSnapshotsAsync(userId, ct);
        return Ok(new { count });
    }

    // ── AI food parsing (proposes entries, does NOT save) ──

    [HttpPost("{date}/parse-food")]
    public async Task<IActionResult> ParseFood(DateOnly date, [FromBody] ParseFoodRequest request)
    {
        var userId = GetUserId();
        var profile = await _profileService.GetByUserIdAsync(userId);
        var options = await GetParsingOptionsAsync(userId);
        var parsed = await _foodParsing.ParseFreeTextAsync(request.FreeText, profile?.Country, options);
        return Ok(parsed);
    }

    // ── AI vision food parsing — accepts a photo (+ optional text context) ──

    [HttpPost("{date}/parse-food-image")]
    public async Task<IActionResult> ParseFoodImage(DateOnly date, [FromBody] ParseFoodWithImageRequest request)
    {
        var userId = GetUserId();
        var profile = await _profileService.GetByUserIdAsync(userId);
        var options = await GetParsingOptionsAsync(userId);
        var parsed = await _foodParsing.ParseImageAsync(
            request.ImageBase64,
            request.MimeType,
            request.FreeText,
            profile?.Country,
            options);
        return Ok(parsed);
    }

    /// <summary>
    /// The prompt only asks for what the user actually tracks: extra fields
    /// make parsing slower, costlier and less accurate for everyone else.
    /// </summary>
    private async Task<FoodParsingOptions> GetParsingOptionsAsync(long userId)
    {
        var prefs = await _macroPreferences.GetForUserAsync(userId);
        return new FoodParsingOptions(
            IncludeSugar: prefs.Any(p => p.MacroKey == MacroTargets.Sugar && p.IsTracked),
            IncludeWater: prefs.Any(p => p.MacroKey == MacroTargets.Water && p.IsTracked));
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
            SugarGrams = i.SugarGrams,
            WaterMl = i.WaterMl,
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

            var created = await _activityService.CreateEntryAsync(entry, item.CaloriesKcal);
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
            SugarGrams = request.SugarGrams,
            WaterMl = request.WaterMl,
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
            SugarGrams = request.SugarGrams,
            WaterMl = request.WaterMl,
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

    /// <summary>
    /// Multi-select delete for one day's meals: one recalculation for the whole
    /// selection instead of a full week cascade per entry.
    /// </summary>
    [HttpPost("{date}/foods/delete-batch")]
    public async Task<IActionResult> DeleteFoodBatch(DateOnly date, [FromBody] DeleteFoodEntriesRequest request)
    {
        var userId = GetUserId();
        var log = await _dailyLogService.GetSummaryByDateAsync(userId, date);
        if (log is null)
            return NotFound();

        var deleted = await _foodEntryService.DeleteBatchAsync(userId, log.DailyLogId, request.FoodEntryIds);
        return Ok(new { deleted });
    }

    /// <summary>Multi-select delete for one day's activities (single recalculation).</summary>
    [HttpPost("{date}/activities/delete-batch")]
    public async Task<IActionResult> DeleteActivityBatch(DateOnly date, [FromBody] DeleteActivityEntriesRequest request)
    {
        var userId = GetUserId();
        var log = await _dailyLogService.GetSummaryByDateAsync(userId, date);
        if (log is null)
            return NotFound();

        var deleted = await _activityService.DeleteEntriesBatchAsync(userId, log.DailyLogId, request.ActivityEntryIds);
        return Ok(new { deleted });
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

    /// <summary>Shared with HistoryController: keeps every daily payload identical.</summary>
    internal static List<DayMacroTargetResponse> MapMacroTargets(string? json) =>
        MacroTargets.ParseJson(json)
            .Select(t => new DayMacroTargetResponse { MacroKey = t.Key, Target = t.Target, Direction = t.Direction })
            .ToList();

    private static DailyLogResponse MapToResponse(DailyLog d) => new()
    {
        DailyLogId = d.DailyLogId,
        LogDate = d.LogDate,
        TotalFoodCaloriesKcal = d.TotalFoodCaloriesKcal,
        TotalProteinGrams = d.TotalProteinGrams,
        TotalFatGrams = d.TotalFatGrams,
        TotalCarbsGrams = d.TotalCarbsGrams,
        TotalAlcoholGrams = d.TotalAlcoholGrams,
        TotalSugarGrams = d.TotalSugarGrams,
        TotalWaterMl = d.TotalWaterMl,
        MacroTargets = MapMacroTargets(d.MacroTargetsJson),
        TotalDailyExpenditureKcal = d.TotalDailyExpenditureKcal,
        DailyGoalDeltaKcal = d.DailyGoalDeltaKcal,
        CaloriesRemainingToDailyTargetKcal = d.CaloriesRemainingToDailyTargetKcal,
        ProteinRemainingGrams = d.ProteinRemainingGrams,
        SuggestedDailyAverageRemainingKcal = d.SuggestedDailyAverageRemainingKcal,
        SnapshotProteinGoalGrams = d.SnapshotProteinGoalGrams,
        SnapshotDailyBaseGoalKcal = d.SnapshotDailyBaseGoalKcal,
        IsFastingDay = d.IsFastingDay,
        HasCalorieBudgetEstimate = d.SnapshotWeightKg.HasValue && d.SnapshotHeightCm.HasValue
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
        SugarGrams = f.SugarGrams,
        WaterMl = f.WaterMl,
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
        IReadOnlyList<ActivityEntry> activities,
        bool hasEverLoggedFood) => new()
    {
        DailyLogId = d.DailyLogId,
        LogDate = d.LogDate,
        TotalFoodCaloriesKcal = d.TotalFoodCaloriesKcal,
        TotalProteinGrams = d.TotalProteinGrams,
        TotalSugarGrams = d.TotalSugarGrams,
        TotalWaterMl = d.TotalWaterMl,
        MacroTargets = MapMacroTargets(d.MacroTargetsJson),
        HasEverLoggedFood = hasEverLoggedFood,
        TotalDailyExpenditureKcal = d.TotalDailyExpenditureKcal,
        DailyGoalDeltaKcal = d.DailyGoalDeltaKcal,
        CaloriesRemainingToDailyTargetKcal = d.CaloriesRemainingToDailyTargetKcal,
        ProteinRemainingGrams = d.ProteinRemainingGrams,
        SuggestedDailyAverageRemainingKcal = d.SuggestedDailyAverageRemainingKcal,
        SnapshotProteinGoalGrams = d.SnapshotProteinGoalGrams,
        SnapshotDailyBaseGoalKcal = d.SnapshotDailyBaseGoalKcal,
        IsFastingDay = d.IsFastingDay,
        FoodEntries = foods.Select(MapFoodToResponse).ToList(),
        ActivityEntries = activities.Select(MapActivityToResponse).ToList(),
        SleepCaloriesKcal = d.SleepCaloriesKcal,
        NeatCaloriesKcal = d.NeatCaloriesKcal,
        SnapshotSleepHours = d.SnapshotSleepHours,
        SnapshotNeatHours = d.SnapshotNeatHours,
        SnapshotWeightKg = d.SnapshotWeightKg,
        SnapshotHeightCm = d.SnapshotHeightCm,
        SnapshotBMRKcal = d.SnapshotBMRKcal,
        SnapshotBodyFatPercent = d.SnapshotBodyFatPercent,
        TotalFatGrams = d.TotalFatGrams,
        TotalCarbsGrams = d.TotalCarbsGrams,
        TotalAlcoholGrams = d.TotalAlcoholGrams,
        TotalActivityCaloriesKcal = d.TotalActivityCaloriesKcal,
        TEFKcal = d.TEFKcal,
        HoursRemainingInDay = d.HoursRemainingInDay,
        IdleTimeCaloriesKcal = d.IdleTimeCaloriesKcal,
        NetBalanceKcal = d.NetBalanceKcal,
        WeekStartDate = d.WeekStartDate,
        WeekEndDate = d.WeekEndDate,
        WeeklyTargetKcal = d.WeeklyTargetKcal,
        WeeklyActualToDateKcal = d.WeeklyActualToDateKcal,
        WeeklyExpectedToDateKcal = d.WeeklyExpectedToDateKcal,
        WeeklyDifferenceKcal = d.WeeklyDifferenceKcal,
        WeeklyRemainingTargetKcal = d.WeeklyRemainingTargetKcal,
    };
}
