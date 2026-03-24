namespace Articalorias.DTOs.ActivityParsing;

public class EstimateMetResponse
{
    public string ActivityName { get; set; } = string.Empty;
    public decimal MetValue { get; set; }
    public string? Explanation { get; set; }
}
