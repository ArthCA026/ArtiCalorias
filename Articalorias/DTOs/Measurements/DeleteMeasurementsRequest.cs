using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Measurements;

/// <summary>Multi-select delete: measurement days chosen in the Body list.</summary>
public class DeleteMeasurementsRequest
{
    [MinLength(1)]
    [MaxLength(400)]
    public List<DateOnly> Dates { get; set; } = [];
}
