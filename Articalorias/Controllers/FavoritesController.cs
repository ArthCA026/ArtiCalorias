using System.Security.Claims;
using Articalorias.DTOs.ActivityParsing;
using Articalorias.DTOs.Favorites;
using Articalorias.DTOs.FoodParsing;
using Articalorias.DTOs.FoodTemplates;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Articalorias.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Articalorias.Controllers;

[ApiController]
[Route("api/favorites")]
[Authorize]
public class FavoritesController : ControllerBase
{
    private readonly IFoodTemplateService _foodTemplateService;
    private readonly IFavoriteRoutineService _routineService;
    private readonly IActivityParsingService _activityParsing;
    private readonly IFoodParsingService _foodParsing;
    private readonly IDailyLogService _dailyLogService;
    private readonly IUserProfileService _userProfileService;
    private readonly ILogger<FavoritesController> _logger;

    public FavoritesController(
        IFoodTemplateService foodTemplateService,
        IFavoriteRoutineService routineService,
        IActivityParsingService activityParsing,
        IFoodParsingService foodParsing,
        IDailyLogService dailyLogService,
        IUserProfileService userProfileService,
        ILogger<FavoritesController> logger)
    {
        _foodTemplateService = foodTemplateService;
        _routineService = routineService;
        _activityParsing = activityParsing;
        _foodParsing = foodParsing;
        _dailyLogService = dailyLogService;
        _userProfileService = userProfileService;
        _logger = logger;
    }

    // ── Food Templates ──

    [HttpGet("food-templates")]
    public async Task<IActionResult> GetFoodTemplates(CancellationToken ct)
    {
        var userId = GetUserId();
        var templates = await _foodTemplateService.GetByUserAsync(userId, ct);
        return Ok(templates.Select(MapToResponse));
    }

    [HttpPost("food-templates")]
    public async Task<IActionResult> CreateFoodTemplate([FromBody] CreateFoodTemplateRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        var template = new FoodTemplate
        {
            UserId = userId,
            TemplateName = request.TemplateName,
            PortionDescription = request.PortionDescription,
            DefaultQuantity = request.DefaultQuantity,
            CaloriesKcal = request.CaloriesKcal,
            ProteinGrams = request.ProteinGrams,
            FatGrams = request.FatGrams,
            CarbsGrams = request.CarbsGrams,
            AlcoholGrams = request.AlcoholGrams,
            AutoAddToNewDay = request.AutoAddToNewDay,
        };
        var created = await _foodTemplateService.CreateAsync(template, ct);
        return Created($"/api/favorites/food-templates/{created.FoodTemplateId}", MapToResponse(created));
    }

    [HttpPut("food-templates/{id:long}")]
    public async Task<IActionResult> UpdateFoodTemplate(long id, [FromBody] UpdateFoodTemplateRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        var template = new FoodTemplate
        {
            FoodTemplateId = id,
            UserId = userId,
            TemplateName = request.TemplateName,
            PortionDescription = request.PortionDescription,
            DefaultQuantity = request.DefaultQuantity,
            CaloriesKcal = request.CaloriesKcal,
            ProteinGrams = request.ProteinGrams,
            FatGrams = request.FatGrams,
            CarbsGrams = request.CarbsGrams,
            AlcoholGrams = request.AlcoholGrams,
            AutoAddToNewDay = request.AutoAddToNewDay,
        };
        var updated = await _foodTemplateService.UpdateAsync(template, ct);
        if (updated is null)
            return NotFound();
        return Ok(MapToResponse(updated));
    }

    [HttpDelete("food-templates/{id:long}")]
    public async Task<IActionResult> DeleteFoodTemplate(long id, CancellationToken ct)
    {
        var userId = GetUserId();
        await _routineService.RemoveItemsByFoodTemplateAsync(id, userId, ct);
        var deleted = await _foodTemplateService.DeleteAsync(id, userId, ct);
        if (!deleted)
            return NotFound();
        return NoContent();
    }

    [HttpGet("food-templates/{id:long}/routines")]
    public async Task<IActionResult> GetFoodTemplateRoutines(long id, CancellationToken ct)
    {
        var userId = GetUserId();
        var names = await _routineService.GetRoutineNamesByFoodTemplateAsync(id, userId, ct);
        return Ok(names);
    }

    [HttpGet("activity-templates/{id:long}/routines")]
    public async Task<IActionResult> GetActivityTemplateRoutines(long id, CancellationToken ct)
    {
        var userId = GetUserId();
        var names = await _routineService.GetRoutineNamesByActivityTemplateAsync(id, userId, ct);
        return Ok(names);
    }

    // ── AI Parse (tab-scoped, mirrors DailyLog pattern) ──

    [HttpPost("parse-activity")]
    public async Task<IActionResult> ParseActivity([FromBody] ParseFavoriteRequest request, CancellationToken ct)
    {
        if (PromptInjectionScanner.ContainsInjection(request.Text))
        {
            _logger.LogWarning("Prompt injection detected in favorites parse-activity: {Input}",
                PromptInjectionScanner.SanitizeForLog(request.Text));
            return BadRequest(new { message = "Invalid input." });
        }

        var activities = await _activityParsing.ParseFreeTextAsync(request.Text);

        var items = activities
            .Where(a => !string.IsNullOrWhiteSpace(a.ActivityName))
            .Where(a => a.DurationMinutes.HasValue && a.DurationMinutes >= 0 && a.DurationMinutes <= 1440)
            .Where(a => a.MetValue.HasValue && a.MetValue >= 0.5m && a.MetValue <= 50m)
            .Select(a => new ParsedFavoriteItem { Type = "activity", Activity = a })
            .ToList();

        if (items.Count == 0)
            return UnprocessableEntity(new { message = "No activity items detected. Try a more descriptive input." });

        return Ok(new ParseFavoriteResponse { Items = items });
    }

    [HttpPost("parse-food")]
    public async Task<IActionResult> ParseFood([FromBody] ParseFavoriteRequest request, CancellationToken ct)
    {
        if (PromptInjectionScanner.ContainsInjection(request.Text))
        {
            _logger.LogWarning("Prompt injection detected in favorites parse-food: {Input}",
                PromptInjectionScanner.SanitizeForLog(request.Text));
            return BadRequest(new { message = "Invalid input." });
        }

        var foods = await _foodParsing.ParseFreeTextAsync(request.Text);

        var items = foods
            .Where(f => !string.IsNullOrWhiteSpace(f.FoodName))
            .Where(f => f.CaloriesKcal >= 0 && f.CaloriesKcal <= 9999.99m)
            .Where(f => f.ProteinGrams >= 0 && f.ProteinGrams <= 9999.99m)
            .Where(f => f.FatGrams >= 0 && f.FatGrams <= 9999.99m)
            .Where(f => f.CarbsGrams >= 0 && f.CarbsGrams <= 9999.99m)
            .Where(f => f.AlcoholGrams >= 0 && f.AlcoholGrams <= 9999.99m)
            .Select(f => new ParsedFavoriteItem { Type = "food", Food = f })
            .ToList();

        if (items.Count == 0)
            return UnprocessableEntity(new { message = "No food items detected. Try a more descriptive input." });

        return Ok(new ParseFavoriteResponse { Items = items });
    }

    // ── Unified AI Parse (kept for backwards compat) ──

    [HttpPost("parse")]
    public async Task<IActionResult> ParseFavorites([FromBody] ParseFavoriteRequest request, CancellationToken ct)
    {
        if (PromptInjectionScanner.ContainsInjection(request.Text))
        {
            _logger.LogWarning("Prompt injection detected in favorites parse: {Input}",
                PromptInjectionScanner.SanitizeForLog(request.Text));
            return BadRequest(new { message = "Invalid input." });
        }

        var parseActivities = request.Type is null or "activity";
        var parseFoods      = request.Type is null or "food";

        var activityTask = parseActivities
            ? _activityParsing.ParseFreeTextAsync(request.Text)
            : Task.FromResult<IReadOnlyList<ParsedActivityItem>>([]);

        var foodTask = parseFoods
            ? _foodParsing.ParseFreeTextAsync(request.Text)
            : Task.FromResult<IReadOnlyList<ParsedFoodItem>>([]);

        await Task.WhenAll(activityTask, foodTask);

        var activities = await activityTask;
        var foods = await foodTask;

        // Validate all returned fields before returning
        var items = new List<ParsedFavoriteItem>();

        foreach (var a in activities)
        {
            if (string.IsNullOrWhiteSpace(a.ActivityName)) continue;
            if (a.DurationMinutes.HasValue && (a.DurationMinutes < 0 || a.DurationMinutes > 1440)) continue;
            if (a.MetValue.HasValue && (a.MetValue < 0.5m || a.MetValue > 50m)) continue;
            items.Add(new ParsedFavoriteItem { Type = "activity", Activity = a });
        }

        foreach (var f in foods)
        {
            if (string.IsNullOrWhiteSpace(f.FoodName)) continue;
            if (f.CaloriesKcal < 0 || f.CaloriesKcal > 9999.99m) continue;
            if (f.ProteinGrams < 0 || f.ProteinGrams > 9999.99m) continue;
            if (f.FatGrams < 0 || f.FatGrams > 9999.99m) continue;
            if (f.CarbsGrams < 0 || f.CarbsGrams > 9999.99m) continue;
            if (f.AlcoholGrams < 0 || f.AlcoholGrams > 9999.99m) continue;
            items.Add(new ParsedFavoriteItem { Type = "food", Food = f });
        }

        if (items.Count == 0)
            return UnprocessableEntity(new { message = "No parseable items found in the provided text." });

        return Ok(new ParseFavoriteResponse { Items = items });
    }

    // ── Routines ──

    [HttpGet("routines")]
    public async Task<IActionResult> GetRoutines(CancellationToken ct)
    {
        var userId = GetUserId();
        var routines = await _routineService.GetByUserAsync(userId, ct);
        return Ok(routines.Select(MapRoutineToResponse));
    }

    [HttpPost("routines")]
    public async Task<IActionResult> CreateRoutine([FromBody] CreateFavoriteRoutineRequest request, CancellationToken ct)
    {
        if (!ValidateRoutineItems(request.Items))
            return BadRequest("Invalid ItemType — must be 'activity' or 'food'.");

        var userId = GetUserId();
        var routine = new FavoriteRoutine
        {
            UserId = userId,
            RoutineName = request.RoutineName,
        };
        var items = request.Items.Select(i => new FavoriteRoutineItem
        {
            ItemType = i.ItemType,
            ActivityTemplateId = i.ActivityTemplateId,
            FoodTemplateId = i.FoodTemplateId,
            SortOrder = i.SortOrder,
        }).ToList();

        var created = await _routineService.CreateAsync(routine, items, ct);
        return Created($"/api/favorites/routines/{created.FavoriteRoutineId}", MapRoutineToResponse(created));
    }

    [HttpPut("routines/{id:long}")]
    public async Task<IActionResult> UpdateRoutine(long id, [FromBody] UpdateFavoriteRoutineRequest request, CancellationToken ct)
    {
        if (!ValidateRoutineItems(request.Items))
            return BadRequest("Invalid ItemType — must be 'activity' or 'food'.");

        var userId = GetUserId();
        var routine = new FavoriteRoutine
        {
            FavoriteRoutineId = id,
            UserId = userId,
            RoutineName = request.RoutineName,
        };
        var items = request.Items.Select(i => new FavoriteRoutineItem
        {
            ItemType = i.ItemType,
            ActivityTemplateId = i.ActivityTemplateId,
            FoodTemplateId = i.FoodTemplateId,
            SortOrder = i.SortOrder,
        }).ToList();

        var updated = await _routineService.UpdateAsync(routine, items, ct);
        if (updated is null)
            return NotFound();
        return Ok(MapRoutineToResponse(updated));
    }

    [HttpDelete("routines/{id:long}")]
    public async Task<IActionResult> DeleteRoutine(long id, CancellationToken ct)
    {
        var userId = GetUserId();
        var deleted = await _routineService.DeleteAsync(id, userId, ct);
        if (!deleted)
            return NotFound();
        return NoContent();
    }

    [HttpPost("routines/{id:long}/add-to-today")]
    public async Task<IActionResult> AddRoutineToToday(long id, CancellationToken ct)
    {
        var userId = GetUserId();

        // Resolve the user's local date using their stored timezone so that users
        // in UTC− timezones don't have entries assigned to the wrong calendar day
        // (e.g. Costa Rica UTC-6: after 18:00 UTC, UtcNow would yield tomorrow).
        // Falls back to UTC if TimeZoneId is null or unrecognised.
        var profile = await _userProfileService.GetByUserIdAsync(userId);
        TimeZoneInfo tz;
        try   { tz = TimeZoneInfo.FindSystemTimeZoneById(profile?.TimeZoneId ?? "UTC"); }
        catch (TimeZoneNotFoundException) { tz = TimeZoneInfo.Utc; }
        catch (InvalidTimeZoneException)  { tz = TimeZoneInfo.Utc; }
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz));

        try
        {
            var result = await _routineService.AddRoutineToTodayAsync(id, userId, today, ct);
            return Ok(result);
        }
        catch (InvalidOperationException)
        {
            return NotFound();
        }
    }

    // ── Helpers ──

    private long GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? throw new UnauthorizedAccessException("User ID claim missing.");
        return long.Parse(claim);
    }

    private static FoodTemplateResponse MapToResponse(FoodTemplate t) => new()
    {
        FoodTemplateId = t.FoodTemplateId,
        TemplateName = t.TemplateName,
        PortionDescription = t.PortionDescription,
        DefaultQuantity = t.DefaultQuantity,
        CaloriesKcal = t.CaloriesKcal,
        ProteinGrams = t.ProteinGrams,
        FatGrams = t.FatGrams,
        CarbsGrams = t.CarbsGrams,
        AlcoholGrams = t.AlcoholGrams,
        AutoAddToNewDay = t.AutoAddToNewDay,
        IsActive = t.IsActive,
    };

    private static FavoriteRoutineResponse MapRoutineToResponse(FavoriteRoutine r) => new()
    {
        FavoriteRoutineId = r.FavoriteRoutineId,
        RoutineName = r.RoutineName,
        SortOrder = r.SortOrder,
        Items = r.Items.Select(i => new FavoriteRoutineItemResponse
        {
            FavoriteRoutineItemId = i.FavoriteRoutineItemId,
            ItemType = i.ItemType,
            SortOrder = i.SortOrder,
            ActivityTemplate = i.ActivityTemplate is null ? null : new
            {
                i.ActivityTemplate.ActivityTemplateId,
                i.ActivityTemplate.TemplateName,
                i.ActivityTemplate.DefaultDurationMinutes,
                i.ActivityTemplate.DefaultMET,
                i.ActivityTemplate.AutoAddToNewDay,
            },
            FoodTemplate = i.FoodTemplate is null ? null : (object)MapToResponse(i.FoodTemplate),
        }).ToList(),
    };

    private static bool ValidateRoutineItems(IEnumerable<CreateFavoriteRoutineItemRequest> items)
    {
        var validTypes = new HashSet<string> { "activity", "food" };
        return items.All(i => validTypes.Contains(i.ItemType));
    }
}
