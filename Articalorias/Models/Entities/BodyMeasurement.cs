namespace Articalorias.Models.Entities;

/// <summary>
/// A dated body measurement (weight and/or body-fat %). One row per user per
/// LOCAL calendar day (unique index): saving twice on the same day updates the
/// existing row, which keeps the weight graph one-point-per-day by design.
/// Profile weight edits create/update the row for the user's local today, and
/// the newest measurement writes back to UserProfile.CurrentWeightKg, so the
/// profile and the graph can never disagree.
/// </summary>
public class BodyMeasurement
{
    public long BodyMeasurementId { get; set; }
    public long UserId { get; set; }

    /// <summary>The user's local calendar date of the measurement.</summary>
    public DateOnly MeasuredOn { get; set; }

    public decimal? WeightKg { get; set; }
    public decimal? BodyFatPercent { get; set; }

    /// <summary>"manual" (Body page), "profile" (profile/onboarding save), "history" (backfill).</summary>
    public string Source { get; set; } = "manual";

    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];

    // Navigation
    public User User { get; set; } = null!;
}
