namespace Articalorias.Services.Macros;

/// <summary>
/// Thermic effect of food, priced per entry and reconciled against the
/// calories that entry actually logged.
///
/// Macro grams alone are not trustworthy enough to price TEF from: the manual
/// form can log calories with no macros at all, a barcode can miss
/// nutriments, a typo can turn 30 g of protein into 300, and the calories can
/// be edited without touching the grams. So the entry's CALORIES are the
/// anchor and the macros only decide the rate:
///
///   macro energy = sum of grams x kcal/g over the energy macros
///   macro TEF    = sum of grams x kcal/g x rate
///
///   macro energy at or below the calories: macro TEF, plus the calories no
///     macro explains at a nominal rate (a calories-only entry therefore
///     earns the same typical-diet TEF the budget estimates assume);
///   macro energy above the calories: macro TEF scaled down to the calories,
///     so a typo can never earn more TEF than the food could carry.
///
/// Either way an entry's TEF stays within the highest catalog rate times its
/// calories, and an entry with no calories earns none. Label noise (fibre,
/// rounding) is absorbed in both directions without a threshold.
///
/// Only energy macros with a TEF rate and no parent contribute: sugar is
/// already inside carbs; fibre, water, caffeine and sodium carry no rate.
/// Retired macros still count, so retiring one never moves a past day.
///
/// History rule: the rates and this reconciliation are code, not a per-day
/// snapshot, so changing either re-prices a day the next time it is
/// recalculated. Bump <see cref="ModelVersion"/> with any such change: the
/// startup backfill (<see cref="Articalorias.Services.TefRepricingBackfill"/>)
/// then re-prices every day once, deliberately, instead of leaving history
/// half old and half new.
/// </summary>
public static class MacroTef
{
    /// <summary>Identifies the TEF pricing rules; keys the one-off re-pricing of stored days.</summary>
    public const string ModelVersion = "2026-09-18.per-entry";

    /// <summary>
    /// Rate for calories an entry logs beyond what its macros explain, when
    /// SOME macros were given: what is missing is then almost always fat and
    /// carbs (the manual form asks for protein up front), priced at the
    /// catalog's own fat and carb rates in a typical 35/65 energy split.
    /// </summary>
    public const decimal PartialRemainderRate = 0.06m;

    public static decimal ForEntry(decimal caloriesKcal, MacroAmounts macros)
    {
        if (caloriesKcal <= 0m)
            return 0m;

        var macroEnergy = 0m;
        var macroTef = 0m;
        foreach (var def in MacroCatalog.All)
        {
            if (!def.ContributesToTef)
                continue;
            var energy = macros.GetOrZero(def.Key) * def.KcalPerGram;
            macroEnergy += energy;
            macroTef += energy * def.TefRate;
        }

        if (macroEnergy <= 0m)
            return caloriesKcal * ExpenditureModel.NominalTefFraction;

        if (macroEnergy > caloriesKcal)
            return macroTef * caloriesKcal / macroEnergy;

        return macroTef + (caloriesKcal - macroEnergy) * PartialRemainderRate;
    }

    /// <summary>The day's TEF: the sum over its entries, at the two decimals the day stores.</summary>
    public static decimal ForDay(IEnumerable<(decimal CaloriesKcal, MacroAmounts Macros)> entries)
        => Math.Round(entries.Sum(e => ForEntry(e.CaloriesKcal, e.Macros)), MacroAmounts.StoredDecimals);
}
