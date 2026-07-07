namespace Articalorias.Configuration;

public class OpenFoodFactsSettings
{
    public const string SectionName = "OpenFoodFacts";

    public string BaseUrl { get; set; } = "https://world.openfoodfacts.org";
    public int TimeoutSeconds { get; set; } = 10;
    public int BarcodeCooldownSeconds { get; set; } = 2;
}
