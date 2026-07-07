using System.Security.Claims;
using Articalorias.Configuration;
using Articalorias.DTOs.FoodParsing;
using Articalorias.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Articalorias.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FoodsController : ControllerBase
{
    private readonly IOpenFoodFactsService _openFoodFacts;
    private readonly IMemoryCache _cache;
    private readonly OpenFoodFactsSettings _settings;

    public FoodsController(
        IOpenFoodFactsService openFoodFacts,
        IMemoryCache cache,
        IOptions<OpenFoodFactsSettings> settings)
    {
        _openFoodFacts = openFoodFacts;
        _cache = cache;
        _settings = settings.Value;
    }

    /// <summary>
    /// Looks up a product by barcode and returns its nutritional data as ParsedFoodItem[].
    /// Returns 404 when the product is not found in the Open Food Facts database.
    /// </summary>
    [HttpPost("by-barcode")]
    public async Task<IActionResult> ByBarcode(
        [FromBody] BarcodeRequest request,
        CancellationToken ct)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return Unauthorized();

        var cooldownKey = $"barcode-cooldown:{userId}";
        if (_cache.TryGetValue(cooldownKey, out _))
        {
            return StatusCode(429, new { message = "Please wait before scanning again." });
        }

        _cache.Set(cooldownKey, true, TimeSpan.FromSeconds(_settings.BarcodeCooldownSeconds));

        var items = await _openFoodFacts.LookupAsync(request.Barcode, ct);

        if (items.Count == 0)
        {
            return NotFound(new { message = $"No product was found for barcode '{request.Barcode}'." });
        }

        return Ok(items);
    }
}
