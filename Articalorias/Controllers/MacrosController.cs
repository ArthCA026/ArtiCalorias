using Articalorias.DTOs.Macros;
using Articalorias.Services.Macros;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Articalorias.Controllers;

/// <summary>
/// The macro catalog: the UI renders whatever this returns (bars, strips,
/// quick-add rows, settings cards), so a new macro never needs a UI release
/// beyond an optional icon or color token.
/// </summary>
[ApiController]
[Route("api/macros")]
[Authorize]
public class MacrosController : ControllerBase
{
    private const string CatalogVersionHeader = "X-Catalog-Version";

    /// <summary>
    /// Static per build. Served with an ETag and no-cache so the browser
    /// revalidates on every page load (a 304 costs nothing) and a deploy
    /// that changes the catalog shows up immediately instead of after a
    /// cache window; the client keeps its own in-memory copy between loads.
    /// </summary>
    [HttpGet("catalog")]
    public IActionResult GetCatalog()
    {
        var etag = $"\"{MacroCatalog.CatalogVersion}\"";

        Response.Headers.CacheControl = "private, no-cache";
        Response.Headers.ETag = etag;
        Response.Headers[CatalogVersionHeader] = MacroCatalog.CatalogVersion;

        if (Request.Headers.IfNoneMatch.Any(v => string.Equals(v?.Trim(), etag, StringComparison.Ordinal)))
            return StatusCode(StatusCodes.Status304NotModified);

        return Ok(MacroCatalogMapper.ToResponse());
    }
}
