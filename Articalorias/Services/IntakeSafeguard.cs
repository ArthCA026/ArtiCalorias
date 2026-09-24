namespace Articalorias.Services;

/// <summary>
/// The minimum daily intake the app will ever suggest, shared by the daily
/// recalculation pipeline (the Today budgets) and by the budget estimate
/// behind onboarding and macro targets, so both floors are always the same
/// number. The frontend mirrors it in src/utils/expenditure.ts.
///
/// Three floors, the highest (most protective) wins:
///
///  1. Sex-based absolute floor (1 200 kcal female, 1 500 kcal otherwise):
///     the widely cited lower bound below which intake should only happen
///     under medical supervision.
///
///  2. Energy-availability floor: 30 kcal per kg of fat-free mass plus the
///     day's exercise calories above resting. Below roughly 30 kcal/kg FFM
///     the body can enter low energy availability, impairing hormonal and
///     physiological function. Falls back to the full BMR when body fat or
///     weight is unknown.
///
///  3. BMR floor: 80 % of the BMR, for people whose BMR is high enough to
///     make the sex floor alone too permissive.
///
/// General guidance, not a prescription: the user can switch the safeguard
/// off in Profile, and the Terms of Service say so.
/// </summary>
public static class IntakeSafeguard
{
    public const decimal FemaleFloorKcal = 1200m;
    public const decimal DefaultFloorKcal = 1500m;
    public const decimal BmrFloorShare = 0.8m;
    public const decimal EnergyAvailabilityKcalPerKgFfm = 30m;

    /// <param name="exerciseKcalAboveResting">
    /// Logged activity calories net of their resting share. Energy availability
    /// is defined against the ADDITIONAL cost of exercise; zero for an estimate
    /// of a day with no workouts.
    /// </param>
    public static decimal MinimumDailyIntakeKcal(
        string? biologicalSex,
        decimal bmrKcal,
        decimal? weightKg,
        decimal? bodyFatPercent,
        decimal exerciseKcalAboveResting)
    {
        var sexFloor = biologicalSex == "F" ? FemaleFloorKcal : DefaultFloorKcal;
        var bmrFloor = bmrKcal * BmrFloorShare;

        decimal eaFloor;
        if (bodyFatPercent is > 0m && weightKg.HasValue)
        {
            var ffmKg = weightKg.Value * (1m - bodyFatPercent.Value / 100m);
            eaFloor = EnergyAvailabilityKcalPerKgFfm * ffmKg + exerciseKcalAboveResting;
        }
        else
        {
            // Body fat or weight unknown: the full BMR still protects against
            // dangerously low suggestions without body-composition data.
            eaFloor = bmrKcal;
        }

        return Math.Max(sexFloor, Math.Max(eaFloor, bmrFloor));
    }
}
