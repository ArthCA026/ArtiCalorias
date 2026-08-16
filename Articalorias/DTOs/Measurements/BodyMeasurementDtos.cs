using System.ComponentModel.DataAnnotations;

namespace Articalorias.DTOs.Measurements;

public class BodyMeasurementResponse
{
    public DateOnly MeasuredOn { get; set; }
    public decimal? WeightKg { get; set; }
    public decimal? BodyFatPercent { get; set; }
    /// <summary>"manual" | "profile" | "history" (backfilled from day snapshots).</summary>
    public string Source { get; set; } = "manual";
}

/// <summary>
/// Upsert payload for one calendar day. At least one value is required; a null
/// leaves the other value untouched when the day already has a measurement.
/// </summary>
public class UpsertBodyMeasurementRequest
{
    [Range(0.1, 500)]
    public decimal? WeightKg { get; set; }

    [Range(1, 75)]
    public decimal? BodyFatPercent { get; set; }
}
