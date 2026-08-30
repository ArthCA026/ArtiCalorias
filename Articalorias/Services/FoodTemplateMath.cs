using Articalorias.Models.Entities;

namespace Articalorias.Services;

/// <summary>
/// Single source of truth for turning a food template into a food entry.
///
/// Template macros are stored PER 1 PORTION (the template sheet edits them as
/// "Per 1 portion" and every save path divides totals down before storing),
/// while entry macros are stored as the TOTAL eaten (the recalculation
/// pipeline sums entry calories without looking at Quantity). Every
/// template → entry materialization must therefore multiply by the default
/// quantity; copying the fields verbatim turns "4 eggs" into an entry that
/// carries one egg's calories.
/// </summary>
public static class FoodTemplateMath
{
    public static FoodEntry ToEntry(FoodTemplate template, long dailyLogId, int sortOrder)
    {
        // Zero/negative default quantity is invalid data; fall back to 1 so a
        // bad template can never silently zero out the meal's macros.
        var qty = template.DefaultQuantity > 0m ? template.DefaultQuantity : 1m;

        return new FoodEntry
        {
            DailyLogId = dailyLogId,
            FoodTemplateId = template.FoodTemplateId,
            FoodName = template.TemplateName,
            PortionDescription = template.PortionDescription,
            Quantity = qty,
            CaloriesKcal = Math.Round(template.CaloriesKcal * qty, 2),
            ProteinGrams = Math.Round(template.ProteinGrams * qty, 2),
            FatGrams = Math.Round(template.FatGrams * qty, 2),
            CarbsGrams = Math.Round(template.CarbsGrams * qty, 2),
            AlcoholGrams = Math.Round(template.AlcoholGrams * qty, 2),
            SugarGrams = template.SugarGrams.HasValue ? Math.Round(template.SugarGrams.Value * qty, 2) : null,
            WaterMl = template.WaterMl.HasValue ? Math.Round(template.WaterMl.Value * qty, 2) : null,
            SortOrder = sortOrder,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        };
    }
}
