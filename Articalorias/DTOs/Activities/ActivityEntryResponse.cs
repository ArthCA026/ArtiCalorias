namespace Articalorias.DTOs.Activities;

public class ActivityEntryResponse
{
    public long ActivityEntryId { get; set; }
    public long? ActivityTemplateId { get; set; }
    public string ActivityName { get; set; } = string.Empty;
    public decimal? DurationMinutes { get; set; }
    public decimal? METValue { get; set; }
    public decimal CalculatedCaloriesKcal { get; set; }
    public int SortOrder { get; set; }
}
