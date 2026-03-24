using Articalorias.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Articalorias.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly AppDbContext _db;

    public HealthController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public IActionResult Get() => Ok(new { Status = "Healthy", Timestamp = DateTime.UtcNow });

    [HttpGet("db")]
    public async Task<IActionResult> GetDbStatus()
    {
        try
        {
            // 1. Can we connect at all?
            bool canConnect = await _db.Database.CanConnectAsync();
            if (!canConnect)
                return StatusCode(503, new { Status = "Database unreachable" });

            // 2. Do the mapped tables exist? Run a lightweight query per entity.
            var counts = new
            {
                Users = await _db.Users.CountAsync(),
                UserProfiles = await _db.UserProfiles.CountAsync(),
                DailyLogs = await _db.DailyLogs.CountAsync(),
                FoodEntries = await _db.FoodEntries.CountAsync(),
                ActivityTemplates = await _db.ActivityTemplates.CountAsync(),
                ActivityTemplateSegments = await _db.ActivityTemplateSegments.CountAsync(),
                ActivityEntries = await _db.ActivityEntries.CountAsync(),
                ActivityEntrySegments = await _db.ActivityEntrySegments.CountAsync(),
                WeeklySummaries = await _db.WeeklySummaries.CountAsync(),
                MonthlySummaries = await _db.MonthlySummaries.CountAsync()
            };

            return Ok(new { Status = "Connected", TableRowCounts = counts });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Status = "Error", Message = ex.Message });
        }
    }
}
