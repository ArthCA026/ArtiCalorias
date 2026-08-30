using Articalorias.Models.Entities;

namespace Articalorias.Services;

/// <summary>
/// The one place the profile turns into a protein goal in grams.
///
/// Two modes:
///  - custom  (AutoCalculateProteinGoal = false): ProteinGoalGrams verbatim.
///  - auto    (AutoCalculateProteinGoal = true):  weight x g/kg multiplier,
///    where the multiplier is the preset the user picked (stored in
///    ProteinGoalGramsPerKg) floored by an age-aware minimum, so the goal
///    follows the body: add or change your weight and the target re-derives
///    itself with no further input. NULL multiplier falls back to the
///    historical 2.0 g/kg so pre-existing auto profiles keep their goal.
///
/// No weight yet = no goal (0): the target activates by itself the moment
/// the weight arrives, because every snapshot builder calls back into here.
/// </summary>
public static class ProteinMath
{
    private const decimal DefaultGramsPerKg = 2.0m;

    /// <summary>Evidence-informed minimum g/kg by age (mirrors the frontend).</summary>
    public static decimal AgeMinimumGramsPerKg(int? age) =>
        age >= 65 ? 1.2m : age >= 50 ? 1.1m : 1.0m;

    /// <summary>The effective protein goal in grams for this profile, 0 = none.</summary>
    public static decimal GoalGrams(UserProfile profile)
    {
        if (!profile.AutoCalculateProteinGoal)
            return profile.ProteinGoalGrams ?? 0m;

        if (!profile.CurrentWeightKg.HasValue)
            return 0m;

        var perKg = Math.Max(
            profile.ProteinGoalGramsPerKg ?? DefaultGramsPerKg,
            AgeMinimumGramsPerKg(profile.Age));
        return Math.Round(profile.CurrentWeightKg.Value * perKg);
    }
}
