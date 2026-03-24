namespace Articalorias.Configuration;

/// <summary>
/// Predetermined TEF (Thermic Effect of Food) rates per macronutrient.
/// These are fixed business-logic constants, not user-configurable.
/// </summary>
public static class TefConstants
{
    public const decimal ProteinTefRate = 0.25m;
    public const decimal FatTefRate = 0.02m;
    public const decimal CarbsTefRate = 0.08m;
    public const decimal AlcoholTefRate = 0.15m;

    private const decimal KcalPerGramProtein = 4m;
    private const decimal KcalPerGramFat = 9m;
    private const decimal KcalPerGramCarbs = 4m;
    private const decimal KcalPerGramAlcohol = 7m;

    public static decimal Calculate(
        decimal proteinGrams,
        decimal fatGrams,
        decimal carbsGrams,
        decimal alcoholGrams)
    {
        return (proteinGrams * KcalPerGramProtein * ProteinTefRate)
             + (fatGrams * KcalPerGramFat * FatTefRate)
             + (carbsGrams * KcalPerGramCarbs * CarbsTefRate)
             + (alcoholGrams * KcalPerGramAlcohol * AlcoholTefRate);
    }
}
