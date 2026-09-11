namespace Articalorias.Services.Macros;

/// <summary>
/// Thermic effect of food from a day's macro totals. Only energy macros with a
/// TEF rate and no parent contribute: sugar is already inside carbs, water,
/// caffeine and sodium carry no energy. Retired macros still count so a
/// historical day keeps the TEF it was lived under.
/// </summary>
public static class MacroTef
{
    public static decimal Calculate(MacroAmounts totals)
    {
        var tef = 0m;
        foreach (var def in MacroCatalog.All)
        {
            if (def.KcalPerGram <= 0m || def.TefRate <= 0m || def.ParentKey is not null)
                continue;
            tef += totals.GetOrZero(def.Key) * def.KcalPerGram * def.TefRate;
        }
        return tef;
    }
}
