using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Articalorias.Configuration;
using Articalorias.DTOs.FoodParsing;
using Articalorias.Interfaces;
using Articalorias.Services.Macros;
using Articalorias.Services.Parsing;
using Microsoft.Extensions.Options;

namespace Articalorias.Services;

/// <summary>
/// Barcode lookup against Open Food Facts. Which nutriments are read is driven
/// by the macro catalog (<see cref="MacroDefinition.OffSources"/>): label data
/// costs nothing extra, so every macro the label provides is captured whether
/// or not the user tracks it yet — the day it gets enabled, the history is
/// already there. A macro the label omits stays absent (never a fake 0).
/// </summary>
public class OpenFoodFactsService : IOpenFoodFactsService
{
    private readonly HttpClient _http;
    private readonly OpenFoodFactsSettings _settings;

    public OpenFoodFactsService(HttpClient http, IOptions<OpenFoodFactsSettings> options)
    {
        _http = http;
        _settings = options.Value;
    }

    public async Task<IReadOnlyList<ParsedFoodItem>> LookupAsync(
        string barcode, CancellationToken ct = default)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromSeconds(_settings.TimeoutSeconds));

        var response = await _http.GetFromJsonAsync<OFFResponse>(
            $"/api/v2/product/{Uri.EscapeDataString(barcode)}.json",
            cts.Token);

        if (response is null || response.Status != 1 || response.Product is null)
            return [];

        var p = response.Product;
        var nutriments = p.Nutriments ?? new Dictionary<string, JsonElement>();
        var useServing = p.ServingQuantity is > 0;

        // Per-serving value when the product declares a serving, else per 100 g.
        // A missing per-serving figure is derived from the per-100 g one so a
        // half-filled label still yields the right portion.
        decimal? Pick(string key)
        {
            if (useServing)
            {
                var perServing = Num(nutriments, $"{key}_serving");
                if (perServing.HasValue)
                    return perServing;

                var per100 = Num(nutriments, $"{key}_100g");
                return per100.HasValue
                    ? per100.Value * (decimal)p.ServingQuantity!.Value / 100m
                    : null;
            }

            return Num(nutriments, $"{key}_100g");
        }

        var item = new ParsedFoodItem
        {
            FoodName = p.ProductName ?? barcode,
            PortionDescription = useServing ? p.ServingSize : "100 g",
            Quantity = 1m,
            CaloriesKcal = Pick("energy-kcal") ?? 0m,
        };

        foreach (var def in MacroCatalog.Active)
        {
            foreach (var source in def.OffSources)
            {
                var value = Pick(source.NutrimentKey);
                if (!value.HasValue)
                    continue;
                item.Macros[def.Key] = Math.Round(value.Value * source.UnitFactor, 2);
                break; // first source that has data wins (salt before sodium)
            }
        }

        return [FoodItemSanitizer.SanitizeLabelData(item)];
    }

    /// <summary>OFF emits numbers, occasionally numeric strings; anything else is "not provided".</summary>
    private static decimal? Num(Dictionary<string, JsonElement> nutriments, string key)
    {
        if (!nutriments.TryGetValue(key, out var element))
            return null;

        switch (element.ValueKind)
        {
            case JsonValueKind.Number:
                return element.TryGetDecimal(out var number) ? number : null;
            case JsonValueKind.String:
                return decimal.TryParse(element.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed)
                    ? parsed
                    : null;
            default:
                return null;
        }
    }

    // ── Open Food Facts response model (private, used only here) ──────────────

    private sealed class OFFResponse
    {
        [JsonPropertyName("status")]       public int Status { get; set; }
        [JsonPropertyName("product")]      public OFFProduct? Product { get; set; }
    }

    private sealed class OFFProduct
    {
        [JsonPropertyName("product_name")]      public string? ProductName { get; set; }
        [JsonPropertyName("serving_size")]      public string? ServingSize { get; set; }
        [JsonPropertyName("serving_quantity")]  public double? ServingQuantity { get; set; }
        [JsonPropertyName("nutriments")]        public Dictionary<string, JsonElement>? Nutriments { get; set; }
    }
}
