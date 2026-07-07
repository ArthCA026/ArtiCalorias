using Articalorias.DTOs.FoodParsing;

namespace Articalorias.Interfaces;

public interface IOpenFoodFactsService
{
    /// <summary>
    /// Looks up a product by barcode in the Open Food Facts database and returns
    /// the nutritional data mapped to <see cref="ParsedFoodItem"/>.
    /// Returns an empty list when the product is not found.
    /// </summary>
    Task<IReadOnlyList<ParsedFoodItem>> LookupAsync(string barcode, CancellationToken ct = default);
}
