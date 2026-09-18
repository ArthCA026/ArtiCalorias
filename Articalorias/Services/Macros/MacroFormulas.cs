using Articalorias.Models.Entities;

namespace Articalorias.Services.Macros;

/// <summary>Lets a formula look at other macros (carbs = what is left after protein and fat).</summary>
public interface IFormulaContext
{
    /// <summary>The target a tracked macro would freeze right now (custom or auto); null when untracked or unknown.</summary>
    decimal? EffectiveTargetOf(string key);

    /// <summary>The auto formula value regardless of tracking; null when the profile cannot support it.</summary>
    decimal? AutoTargetOf(string key);
}

/// <summary>
/// The one place a <see cref="TargetFormula"/> turns into a number. Auto
/// targets derive from the same daily budget the onboarding preview shows:
/// <see cref="ExpenditureModel.EstimateDailyBudgetKcal"/>, i.e. the pipeline's
/// own sleep / NEAT / idle pricing for the profile's hours, the signed goal
/// and a nominal TEF, floored at 800 kcal.
/// </summary>
public static class MacroFormulas
{
    private const decimal BudgetFloorKcal = 800m;

    /// <summary>Intake budget estimate; null until the profile has a weight and a BMR.</summary>
    public static decimal? CalorieBudget(UserProfile? profile)
    {
        var budget = ExpenditureModel.EstimateDailyBudgetKcal(profile);
        return budget is null ? null : Math.Max(budget.Value, BudgetFloorKcal);
    }

    /// <summary>Evidence-informed minimum protein g/kg by age (mirrors the frontend).</summary>
    public static decimal AgeMinimumGramsPerKg(int? age) =>
        age >= 65 ? 1.2m : age >= 50 ? 1.1m : 1.0m;

    /// <summary>
    /// The formula value for a macro, or null when the profile cannot support
    /// it (missing weight or BMR) or the macro has no formula.
    /// </summary>
    public static decimal? Evaluate(MacroDefinition def, UserProfile? profile, decimal? autoParam, IFormulaContext context)
    {
        switch (def.Formula)
        {
            case TargetFormula.None:
                return null;

            case TargetFormula.FixedAmount fixedAmount:
                return fixedAmount.Value;

            case TargetFormula.PerKgBodyWeight perKg:
            {
                var weight = profile?.CurrentWeightKg;
                if (!weight.HasValue || weight.Value <= 0m)
                    return null;

                var param = autoParam ?? perKg.DefaultParam;
                if (perKg.ApplyAgeFloor)
                    param = Math.Max(param, AgeMinimumGramsPerKg(profile!.Age));

                var multiple = perKg.RoundToMultiple > 0m ? perKg.RoundToMultiple : 1m;
                return Math.Round(weight.Value * param / multiple) * multiple;
            }

            case TargetFormula.PercentOfBudget percent:
            {
                var budget = CalorieBudget(profile);
                if (budget is null || def.KcalPerGram <= 0m)
                    return null;

                var grams = Math.Round(budget.Value * percent.Percent / def.KcalPerGram);
                return percent.Cap.HasValue ? Math.Min(percent.Cap.Value, grams) : grams;
            }

            case TargetFormula.CarbsRemainder:
            {
                var budget = CalorieBudget(profile);
                if (budget is null)
                    return null;

                var proteinKcal = (context.EffectiveTargetOf("protein") ?? 0m) * KcalPerGramOf("protein");
                var fatKcal = (context.AutoTargetOf("fat") ?? 0m) * KcalPerGramOf("fat");
                var perGram = def.KcalPerGram > 0m ? def.KcalPerGram : 4m;
                return Math.Max(Math.Round((budget.Value - proteinKcal - fatKcal) / perGram), 0m);
            }

            case TargetFormula.PerKgBodyWeightCapped capped:
            {
                var weight = profile?.CurrentWeightKg;
                if (!weight.HasValue || weight.Value <= 0m)
                    return capped.Cap; // the population ceiling until the body is known

                var perKg = profile!.Age is < 18 ? capped.MinorPerKg : capped.AdultPerKg;
                var multiple = capped.RoundToMultiple > 0m ? capped.RoundToMultiple : 1m;
                var scaled = Math.Round(weight.Value * perKg / multiple) * multiple;
                return Math.Min(scaled, capped.Cap);
            }

            case TargetFormula.PerThousandKcal perThousand:
            {
                var budget = CalorieBudget(profile);
                if (budget is null)
                    return null;
                return Math.Round(budget.Value / 1000m * perThousand.ValuePer1000Kcal);
            }

            default:
                return null;
        }
    }

    private static decimal KcalPerGramOf(string key)
        => MacroCatalog.TryGet(key, out var def) ? def.KcalPerGram : 0m;
}
