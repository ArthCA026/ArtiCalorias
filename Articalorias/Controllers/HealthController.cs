using Articalorias.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Articalorias.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<HealthController> _logger;

    public HealthController(AppDbContext db, ILogger<HealthController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>Liveness ping: static body, no data, safe to expose.</summary>
    [HttpGet]
    [AllowAnonymous]
    public IActionResult Get() => Ok(new { Status = "Healthy", Timestamp = DateTime.UtcNow });

    /// <summary>
    /// Database reachability for a signed-in caller. Row counts and exception
    /// text used to be returned here; both are business/infrastructure detail
    /// that an anonymous caller has no business reading.
    /// </summary>
    [HttpGet("db")]
    [Authorize]
    public async Task<IActionResult> GetDbStatus(CancellationToken ct)
    {
        try
        {
            var canConnect = await _db.Database.CanConnectAsync(ct);
            return canConnect
                ? Ok(new { Status = "Connected" })
                : StatusCode(503, new { Status = "Database unreachable" });
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Database health check failed");
            return StatusCode(503, new { Status = "Database unreachable" });
        }
    }
}
