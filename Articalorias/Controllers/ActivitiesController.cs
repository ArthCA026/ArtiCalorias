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

    public ActivitiesController(IActivityService activityService, IDailyLogService dailyLogService, IActivityParsingService activityParsing)
    {
        _activityService = activityService;
        _dailyLogService = dailyLogService;
        _activityParsing = activityParsing;
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
            ActivityType = request.ActivityType,
            ActivityName = request.ActivityName,
            DurationMinutes = request.DurationMinutes,
            METValue = request.METValue,
            Notes = request.Notes,
            Segments = request.Segments.Select(s => new ActivityEntrySegment
            {
                SegmentOrder = s.SegmentOrder,
                SegmentName = s.SegmentName,
                METValue = s.METValue,
                DurationMinutes = s.DurationMinutes
            }).ToList()
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
            ActivityType = request.ActivityType,
            ActivityName = request.ActivityName,
            DurationMinutes = request.DurationMinutes,
            METValue = request.METValue,
            Notes = request.Notes,
            Segments = request.Segments.Select(s => new ActivityEntrySegment
            {
                SegmentOrder = s.SegmentOrder,
                SegmentName = s.SegmentName,
                METValue = s.METValue,
                DurationMinutes = s.DurationMinutes
            }).ToList()
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

        var template = new ActivityTemplate
        {
            UserId = request.TemplateScope == "SYSTEM" ? null : userId,
            TemplateScope = request.TemplateScope,
            ActivityType = request.ActivityType,
            TemplateName = request.TemplateName,
            AutoAddToNewDay = request.AutoAddToNewDay,
            DefaultDurationMinutes = request.DefaultDurationMinutes,
            DefaultMET = request.DefaultMET,
            IsActive = true,
            Segments = request.Segments.Select(s => new ActivityTemplateSegment
            {
                SegmentOrder = s.SegmentOrder,
                SegmentName = s.SegmentName,
                METValue = s.METValue,
                DefaultDurationMinutes = s.DurationMinutes
            }).ToList()
        };

        var created = await _activityService.CreateTemplateAsync(template);
        return Created($"/api/activities/templates/{created.ActivityTemplateId}", MapTemplateToResponse(created));
    }

    [HttpPut("templates/{templateId}")]
    public async Task<IActionResult> UpdateTemplate(long templateId, [FromBody] ActivityTemplateRequest request)
    {
        var template = new ActivityTemplate
        {
            ActivityTemplateId = templateId,
            ActivityType = request.ActivityType,
            TemplateName = request.TemplateName,
            AutoAddToNewDay = request.AutoAddToNewDay,
            DefaultDurationMinutes = request.DefaultDurationMinutes,
            DefaultMET = request.DefaultMET,
            Segments = request.Segments.Select(s => new ActivityTemplateSegment
            {
                SegmentOrder = s.SegmentOrder,
                SegmentName = s.SegmentName,
                METValue = s.METValue,
                DefaultDurationMinutes = s.DurationMinutes
            }).ToList()
        };

        var updated = await _activityService.UpdateTemplateAsync(template);
        return Ok(MapTemplateToResponse(updated));
    }

    [HttpDelete("templates/{templateId}")]
    public async Task<IActionResult> DeleteTemplate(long templateId)
    {
        await _activityService.DeleteTemplateAsync(templateId);
        return NoContent();
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
        ActivityType = a.ActivityType,
        ActivityName = a.ActivityName,
        DurationMinutes = a.DurationMinutes,
        METValue = a.METValue,
        CalculatedCaloriesKcal = a.CalculatedCaloriesKcal,
        IsGlobalDefault = a.IsGlobalDefault,
        IsFromSystemTemplate = a.ActivityTemplate?.TemplateScope == "SYSTEM",
        Notes = a.Notes,
        SortOrder = a.SortOrder,
        Segments = a.Segments.Select(s => new ActivityEntrySegmentDto
        {
            SegmentOrder = s.SegmentOrder,
            SegmentName = s.SegmentName,
            METValue = s.METValue,
            DurationMinutes = s.DurationMinutes
        }).ToList()
    };

    private static ActivityTemplateResponse MapTemplateToResponse(ActivityTemplate t) => new()
    {
        ActivityTemplateId = t.ActivityTemplateId,
        TemplateScope = t.TemplateScope,
        ActivityType = t.ActivityType,
        TemplateName = t.TemplateName,
        AutoAddToNewDay = t.AutoAddToNewDay,
        IsActive = t.IsActive,
        DefaultDurationMinutes = t.DefaultDurationMinutes,
        DefaultMET = t.DefaultMET,
        Segments = t.Segments.Select(s => new ActivityTemplateSegmentDto
        {
            SegmentOrder = s.SegmentOrder,
            SegmentName = s.SegmentName,
            METValue = s.METValue,
            DurationMinutes = s.DefaultDurationMinutes
        }).ToList()
    };
}
