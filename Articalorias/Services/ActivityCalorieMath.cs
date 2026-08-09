using Articalorias.Models.Entities;

namespace Articalorias.Services;

/// <summary>
/// Single source of truth for activity energy math.
///
/// Activities store GROSS calories: MET × weight(kg) × hours, which includes the
/// resting burn of that timeframe (1 MET ≈ 1 kcal/kg/h, the MET reference rate).
/// This matches what watches and other trackers report. To avoid double counting,
/// the daily expenditure pipeline subtracts weight × activity-hours from the BMR
/// line, so the BMR only covers the hours of the day without logged activities.
/// The total expenditure is algebraically identical to the previous (MET − 1) model.
///
/// When the user supplies the burned calories directly (e.g. from a smart watch),
/// that number is authoritative and the missing dimension is derived from it:
///   calories + duration  → MET      = kcal / (weight × hours)
///   calories + MET       → duration = kcal / (MET × weight) hours
/// </summary>
public static class ActivityCalorieMath
{
    public const decimal MinMet = 0.5m;
    public const decimal MaxMet = 50m;
    public const decimal MaxDurationMinutes = 1440m;

    /// <summary>Gross calories for a MET-based activity (resting share included).</summary>
    public static decimal GrossCalories(decimal met, decimal weightKg, decimal durationMinutes)
        => met * weightKg * (durationMinutes / 60m);

    /// <summary>
    /// Resting calories already contained in the gross figures of a day's activities,
    /// priced at the MET reference rate (1 kcal/kg/h). The recalculation pipeline
    /// subtracts this from the full-day BMR so resting energy is never counted twice.
    /// </summary>
    public static decimal RestingOffset(decimal weightKg, decimal totalActivityMinutes)
        => weightKg * (totalActivityMinutes / 60m);

    /// <summary>
    /// Fills <see cref="ActivityEntry.CalculatedCaloriesKcal"/> and derives any
    /// missing MET/duration on the entry.
    ///
    /// providedCaloriesKcal &gt; 0 means the user supplied the burn directly
    /// (smart watch): it is stored as-is and MET or duration is derived when the
    /// weight allows it. Otherwise calories are computed from MET × weight × hours.
    /// Entries with no MET or no duration and no provided calories keep their
    /// previously stored calories untouched.
    /// </summary>
    public static void Apply(ActivityEntry entry, decimal weightKg, decimal? providedCaloriesKcal)
    {
        if (providedCaloriesKcal is > 0m)
        {
            entry.CalculatedCaloriesKcal = providedCaloriesKcal.Value;

            if (weightKg <= 0m)
                return; // No weight: store the calories, nothing can be derived.

            var hasDuration = entry.DurationMinutes is > 0m;
            var hasMet = entry.METValue is > 0m;

            if (hasDuration)
            {
                // Calories + duration → the actual MET of the session.
                var hours = entry.DurationMinutes!.Value / 60m;
                var met = providedCaloriesKcal.Value / (weightKg * hours);
                entry.METValue = Math.Clamp(Math.Round(met, 2), MinMet, MaxMet);
            }
            else if (hasMet)
            {
                // Calories + MET → how long the session must have lasted.
                var hours = providedCaloriesKcal.Value / (entry.METValue!.Value * weightKg);
                var minutes = Math.Round(hours * 60m, 0);
                entry.DurationMinutes = Math.Clamp(minutes, 1m, MaxDurationMinutes);
            }
            // Calories only: stored as a flat burn with no MET/duration.
            return;
        }

        if (entry.METValue.HasValue && entry.DurationMinutes.HasValue)
        {
            // Gross MET formula — no (MET − 1): the resting share stays inside the
            // activity figure and is offset once at the day level via RestingOffset.
            entry.CalculatedCaloriesKcal =
                GrossCalories(entry.METValue.Value, weightKg, entry.DurationMinutes.Value);
        }
    }
}
