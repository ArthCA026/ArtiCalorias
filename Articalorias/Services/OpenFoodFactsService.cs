using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Articalorias.Configuration;
using Articalorias.DTOs.FoodParsing;
using Articalorias.Interfaces;
using Microsoft.Extensions.Options;

namespace Articalorias.Services;

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
        var n = p.Nutriments ?? new OFFNutriments();

        bool useServing = p.ServingQuantity > 0;

        return
        [
            new ParsedFoodItem
            {
                FoodName        = p.ProductName ?? barcode,
                PortionDescription = useServing ? p.ServingSize : "100 g",
                Quantity        = 1m,
                CaloriesKcal    = ToDecimal(useServing ? n.EnergyKcalServing   : n.EnergyKcal100g),
                ProteinGrams    = ToDecimal(useServing ? n.ProteinsServing      : n.Proteins100g),
                FatGrams        = ToDecimal(useServing ? n.FatServing           : n.Fat100g),
                CarbsGrams      = ToDecimal(useServing ? n.CarbohydratesServing : n.Carbohydrates100g),
                AlcoholGrams    = ToDecimal(useServing ? n.AlcoholServing       : n.Alcohol100g),
                // Label data costs nothing extra, so sugar is captured whether
                // or not the user tracks it yet: the day it gets enabled, the
                // history is already there. Null (not 0) when the label omits it.
                SugarGrams      = ToNullableDecimal(useServing ? n.SugarsServing : n.Sugars100g),
            }
        ];
    }

    private static decimal ToDecimal(double? value) =>
        value is null or double.NaN ? 0m : (decimal)value;

    private static decimal? ToNullableDecimal(double? value) =>
        value is null or double.NaN ? null : (decimal)value;

    // ── Open Food Facts response model (private, used only here) ──────────────

    private sealed class OFFResponse
    {
        [JsonPropertyName("status")]
        public int Status { get; set; }

        [JsonPropertyName("product")]
        public OFFProduct? Product { get; set; }
    }

    private sealed class OFFProduct
    {
        [JsonPropertyName("product_name")]
        public string? ProductName { get; set; }

        [JsonPropertyName("serving_size")]
        public string? ServingSize { get; set; }

        [JsonPropertyName("serving_quantity")]
        public double? ServingQuantity { get; set; }

        [JsonPropertyName("nutriments")]
        public OFFNutriments? Nutriments { get; set; }
    }

    private sealed class OFFNutriments
    {
        [JsonPropertyName("energy-kcal_100g")]
        public double? EnergyKcal100g { get; set; }

        [JsonPropertyName("energy-kcal_serving")]
        public double? EnergyKcalServing { get; set; }

        [JsonPropertyName("proteins_100g")]
        public double? Proteins100g { get; set; }

        [JsonPropertyName("proteins_serving")]
        public double? ProteinsServing { get; set; }

        [JsonPropertyName("fat_100g")]
        public double? Fat100g { get; set; }

        [JsonPropertyName("fat_serving")]
        public double? FatServing { get; set; }

        [JsonPropertyName("carbohydrates_100g")]
        public double? Carbohydrates100g { get; set; }

        [JsonPropertyName("carbohydrates_serving")]
        public double? CarbohydratesServing { get; set; }

        [JsonPropertyName("sugars_100g")]
        public double? Sugars100g { get; set; }

        [JsonPropertyName("sugars_serving")]
        public double? SugarsServing { get; set; }

        [JsonPropertyName("alcohol_100g")]
        public double? Alcohol100g { get; set; }

        [JsonPropertyName("alcohol_serving")]
        public double? AlcoholServing { get; set; }
    }
}
