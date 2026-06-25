using System.Security.Claims;
using Articalorias.DTOs.Activities;
using Articalorias.DTOs.ActivityParsing;
using Articalorias.Interfaces;
using Articalorias.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Articalorias.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ActivitiesController : ControllerBase
{
    private readonly IActivityService _activityService;
    private readonly IDailyLogService _dailyLogService;
    private readonly IActivityParsingService _activityParsing;
    private readonly IFavoriteRoutineService _routineService;

    public ActivitiesController(IActivityService activityService, IDailyLogService dailyLogService, IActivityParsingService activityParsing, IFavoriteRoutineService routineService)
    {
        _activityService = activityService;
        _dailyLogService = dailyLogService;
        _activityParsing = activityParsing;
        _routineService = routineService;
    }

    // ── Daily activity entries ──

    [HttpGet("daily/{date}")]
    public async Task<IActionResult> GetDailyEntries(DateOnly date)
    {
        var userId = GetUserId();
        var log = await _dailyLogService.GetByDateAsync(userId, date);
        if (log is null)
            return Ok(Array.Empty<ActivityEntryResponse>());

        var entries = await _activityService.GetEntriesByDailyLogAsync(log.DailyLogId);
        return Ok(entries.Select(MapEntryToResponse));
    }

    [HttpPost("daily/{date}")]
    public async Task<IActionResult> AddEntry(DateOnly date, [FromBody] CreateActivityEntryRequest request)
    {
        var userId = GetUserId();
        var log = await _dailyLogService.GetOrCreateAsync(userId, date);

        var entry = new ActivityEntry
        {
            DailyLogId = log.DailyLogId,
            ActivityTemplateId = request.ActivityTemplateId,
            ActivityName = request.ActivityName,
            DurationMinutes = request.DurationMinutes,
            METValue = request.METValue
        };

        var created = await _activityService.CreateEntryAsync(entry);
        return Created($"/api/activities/daily/{date}/{created.ActivityEntryId}", MapEntryToResponse(created));
    }

    [HttpPut("daily/{date}/{activityEntryId}")]
    public async Task<IActionResult> UpdateEntry(DateOnly date, long activityEntryId, [FromBody] UpdateActivityEntryRequest request)
    {
        var entry = new ActivityEntry
        {
            ActivityEntryId = activityEntryId,
            ActivityName = request.ActivityName,
            DurationMinutes = request.DurationMinutes,
            METValue = request.METValue
        };

        var updated = await _activityService.UpdateEntryAsync(entry);
        return Ok(MapEntryToResponse(updated));
    }

    [HttpDelete("daily/{date}/{activityEntryId}")]
    public async Task<IActionResult> DeleteEntry(DateOnly date, long activityEntryId)
    {
        await _activityService.DeleteEntryAsync(activityEntryId);
        return NoContent();
    }

    // ── Activity templates (catalog) ──

    [HttpGet("templates")]
    public async Task<IActionResult> GetTemplates()
    {
        var userId = GetUserId();
        var templates = await _activityService.GetTemplatesAsync(userId);
        return Ok(templates.Select(MapTemplateToResponse));
    }

    [HttpPost("templates")]
    public async Task<IActionResult> CreateTemplate([FromBody] ActivityTemplateRequest request)
    {
        var userId = GetUserId();

        if (!request.DefaultDurationMinutes.HasValue || !request.DefaultMET.HasValue)
            return BadRequest(new { message = "Duration and MET value are required for activity templates." });
        var template = new ActivityTemplate
        {
            UserId = userId,
            TemplateName = request.TemplateName,
            AutoAddToNewDay = request.AutoAddToNewDay,
            DefaultDurationMinutes = request.DefaultDurationMinutes,
            DefaultMET = request.DefaultMET,
            IsActive = true
        };

        var created = await _activityService.CreateTemplateAsync(template);
        return Created($"/api/activities/templates/{created.ActivityTemplateId}", MapTemplateToResponse(created));
    }

    [HttpPut("templates/{templateId}")]
    public async Task<IActionResult> UpdateTemplate(long templateId, [FromBody] ActivityTemplateRequest request)
    {
        var userId = GetUserId();
        var template = new ActivityTemplate
        {
            ActivityTemplateId = templateId,
            UserId = userId,
            TemplateName = request.TemplateName,
            AutoAddToNewDay = request.AutoAddToNewDay,
            DefaultDurationMinutes = request.DefaultDurationMinutes,
            DefaultMET = request.DefaultMET
        };

        var updated = await _activityService.UpdateTemplateAsync(template);
        if (updated is null) return NotFound();
        return Ok(MapTemplateToResponse(updated));
    }

    [HttpDelete("templates/{templateId}")]
    public async Task<IActionResult> DeleteTemplate(long templateId, CancellationToken ct)
    {
        var userId = GetUserId();
        await _routineService.RemoveItemsByActivityTemplateAsync(templateId, userId, ct);
        var deleted = await _activityService.DeleteTemplateAsync(templateId, userId);
        if (!deleted) return NotFound();
        return NoContent();
    }

    [HttpGet("templates/{templateId}/routines")]
    public async Task<IActionResult> GetTemplateRoutines(long templateId, CancellationToken ct)
    {
        var userId = GetUserId();
        var names = await _routineService.GetRoutineNamesByActivityTemplateAsync(templateId, userId, ct);
        return Ok(names);
    }

    // ── AI activity parsing (proposes structured data, does NOT save) ──

    [HttpPost("parse-activity")]
    public async Task<IActionResult> ParseActivity([FromBody] ParseActivityRequest request)
    {
        var parsed = await _activityParsing.ParseFreeTextAsync(request.FreeText);
        return Ok(parsed);
    }

    // ── AI MET estimation ──

    [HttpPost("estimate-met")]
    public async Task<IActionResult> EstimateMet([FromBody] EstimateMetRequest request)
    {
        var result = await _activityParsing.EstimateMetAsync(request.ActivityName, request.DurationMinutes);
        return Ok(result);
    }

    // ── Helpers ──

    private long GetUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException();
        return long.Parse(claim.Value);
    }

    private static ActivityEntryResponse MapEntryToResponse(ActivityEntry a) => new()
    {
        ActivityEntryId = a.ActivityEntryId,
        ActivityTemplateId = a.ActivityTemplateId,
        ActivityName = a.ActivityName,
        DurationMinutes = a.DurationMinutes,
        METValue = a.METValue,
        CalculatedCaloriesKcal = a.CalculatedCaloriesKcal,
        SortOrder = a.SortOrder
    };

    private static ActivityTemplateResponse MapTemplateToResponse(ActivityTemplate t) => new()
    {
        ActivityTemplateId = t.ActivityTemplateId,
        TemplateName = t.TemplateName,
        AutoAddToNewDay = t.AutoAddToNewDay,
        IsActive = t.IsActive,
        DefaultDurationMinutes = t.DefaultDurationMinutes,
        DefaultMET = t.DefaultMET
    };
}
