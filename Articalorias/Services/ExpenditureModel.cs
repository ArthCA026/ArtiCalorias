using Articalorias.Models.Entities;

namespace Articalorias.Services;

/// <summary>
/// The one place the hours of a day turn into energy. Every consumer of the
/// sleep / everyday-movement (NEAT) / idle model reads its constants and
/// formulas from here: the daily recalculation pipeline, the calorie budget
/// behind macro targets, the profile validation and the API defaults. The
/// frontend mirrors these numbers in src/utils/expenditure.ts; keep both in step.
///
/// Model. Resting energy for the whole day is the BMR. Each block of hours
/// then contributes only its difference from resting, priced at the MET
/// reference rate of 1 kcal per kg per hour:
///
///   block kcal = (MET - 1) x weight kg x hours
///
/// Sleep sits below resting (negative), everyday movement and idle awake
/// time above it. Logged activities are priced gross elsewhere
/// (<see cref="ActivityCalorieMath"/>) and offset against the BMR line, so
/// the four blocks always add up to exactly 24 hours: activities first (they
/// are explicit logs), then sleep, then NEAT, and whatever is left is idle.
/// </summary>
public static class ExpenditureModel
{
    public const decimal HoursPerDay = 24m;

    /// <summary>MET reference rate: resting energy of 1 kcal per kg per hour, already inside the BMR.</summary>
    public const decimal RestingMet = 1m;

    /// <summary>Sleeping metabolic rate runs 5 to 15 percent below resting; the Compendium lists 0.9 to 0.95.</summary>
    public const decimal SleepMet = 0.9m;

    /// <summary>
    /// Everyday movement outside workouts: standing, chores, cooking, slow
    /// walking around. The Compendium places these between 2.0 and 3.3 MET;
    /// a blended hour lands near 2.3. Workouts and walks the user logs as
    /// activities are priced by their own MET and must NOT be part of these hours.
    /// </summary>
    public const decimal NeatMet = 2.3m;

    /// <summary>Seated, screen and desk time: 1.0 to 1.3 MET in the Compendium.</summary>
    public const decimal IdleMet = 1.2m;

    /// <summary>Profile default when the user has not set their hours (onboarding does not ask).</summary>
    public const decimal DefaultSleepHours = 8m;

    /// <summary>
    /// Default everyday-movement hours. Paired with <see cref="NeatMet"/> it puts a
    /// sedentary adult with no logged workouts at a PAL of roughly 1.40, the
    /// bottom of the WHO "sedentary" band, which is the right place for a default.
    /// </summary>
    public const decimal DefaultNeatHours = 3m;

    /// <summary>Per-field ceilings; identical to the editor in the app.</summary>
    public const int MaxSleepHours = 16;
    public const int MaxNeatHours = 16;

    /// <summary>Sleep plus everyday movement may reserve at most this many hours; at least one hour stays free.</summary>
    public const decimal MaxReservedHours = 23m;

    /// <summary>
    /// Thermic effect of a typical mixed diet, as a fraction of intake. The
    /// pipeline prices TEF from what was actually eaten (<see cref="Macros.MacroTef"/>);
    /// this nominal rate covers what cannot be priced that way: the budget
    /// ESTIMATES (onboarding preview, macro targets), so they land where the
    /// Today budget ends up once the day has been eaten, and logged calories
    /// that carry no macros at all. The Today budget itself is never
    /// estimated ahead: it only counts the TEF of food already logged, so it
    /// grows a little with every meal (a deliberate choice, 2026-09-18: no
    /// guessed numbers on the day view).
    /// </summary>
    public const decimal NominalTefFraction = 0.10m;

    /// <summary>How a day's 24 hours were split for pricing. Null sleep/NEAT = the day predates the feature.</summary>
    public readonly record struct DayHours(decimal ActivityHours, decimal? SleepHours, decimal? NeatHours, decimal IdleHours);

    /// <summary>
    /// Fits the reserved hours into the day. Logged activities are facts and
    /// keep their full duration; sleep is squeezed next and everyday movement
    /// last, because it is the softest estimate. This only ever bites when
    /// the profile hours grew after activities were logged (refresh-snapshot)
    /// or routine templates auto-added more than the free hours: the per-entry
    /// cap in ActivityService prevents the overflow on the normal path.
    /// </summary>
    public static DayHours FitDay(decimal? sleepHours, decimal? neatHours, decimal activityMinutes)
    {
        var activityH = Math.Clamp(activityMinutes / 60m, 0m, HoursPerDay);
        var free = HoursPerDay - activityH;

        decimal? sleepH = sleepHours.HasValue ? Math.Clamp(sleepHours.Value, 0m, free) : null;
        free -= sleepH ?? 0m;

        decimal? neatH = neatHours.HasValue ? Math.Clamp(neatHours.Value, 0m, free) : null;
        free -= neatH ?? 0m;

        return new DayHours(activityH, sleepH, neatH, free);
    }

    /// <summary>Negative: sleep burns less than resting.</summary>
    public static decimal SleepDeltaKcal(decimal weightKg, decimal hours) => (SleepMet - RestingMet) * weightKg * hours;

    public static decimal NeatDeltaKcal(decimal weightKg, decimal hours) => (NeatMet - RestingMet) * weightKg * hours;

    public static decimal IdleDeltaKcal(decimal weightKg, decimal hours) => (IdleMet - RestingMet) * weightKg * hours;

    public static bool ReservedHoursFit(decimal sleepHours, decimal neatHours) => sleepHours + neatHours <= MaxReservedHours;

    /// <summary>
    /// Maintenance for a day with no logged workouts: BMR plus the sleep, NEAT
    /// and idle deltas for the profile's own hours, before TEF. Null until the
    /// profile has a weight and a BMR.
    /// </summary>
    public static decimal? EstimateMaintenanceKcal(UserProfile? profile)
    {
        if (profile is null || !profile.CurrentWeightKg.HasValue || profile.BMRKcal <= 0m)
            return null;

        var weight = profile.CurrentWeightKg.Value;
        var hours = FitDay(profile.SleepHours, profile.NeatHours, activityMinutes: 0m);
        return profile.BMRKcal
            + SleepDeltaKcal(weight, hours.SleepHours ?? 0m)
            + NeatDeltaKcal(weight, hours.NeatHours ?? 0m)
            + IdleDeltaKcal(weight, hours.IdleHours);
    }

    /// <summary>
    /// The intake that closes the day on the profile's goal: maintenance plus
    /// the signed goal, grossed up for the TEF of eating that much. Solves
    /// budget = maintenance + TEF(budget) + goal with TEF at the nominal rate,
    /// which is what the Today "goal" budget converges to once the food is in
    /// (on a day with no logged workouts), with the same minimum-intake
    /// safeguard the Today budget applies, so macro targets add up to the
    /// calorie budget the day ends on. Null until the profile has a weight
    /// and a BMR.
    /// </summary>
    public static decimal? EstimateDailyBudgetKcal(UserProfile? profile)
    {
        var maintenance = EstimateMaintenanceKcal(profile);
        if (maintenance is null)
            return null;

        var budget = (maintenance.Value + profile!.DailyBaseGoalKcal) / (1m - NominalTefFraction);
        if (!profile.MinCaloriesSafeguardEnabled)
            return budget;

        var floor = IntakeSafeguard.MinimumDailyIntakeKcal(
            profile.BiologicalSex, profile.BMRKcal, profile.CurrentWeightKg, profile.BodyFatPercent,
            exerciseKcalAboveResting: 0m);
        return Math.Max(budget, floor);
    }
}
