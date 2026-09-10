using System.Text.RegularExpressions;

namespace Articalorias.Services.Parsing;

/// <summary>
/// Lexically splits a SINGLE-item food phrase into (quantity, food remainder)
/// so the cache can store the food once, per unit, and serve every quantity of
/// it: "2 huevos", "12 eggs" and "dos huevos" all resolve through one cached
/// entry ("huevos"/"eggs") whose per-unit values get multiplied by the
/// requested quantity. Conservative on purpose — anything ambiguous returns
/// null and falls through to the exact-match cache, never to a wrong answer.
/// </summary>
internal static partial class QuantityNormalizer
{
    [GeneratedRegex(@"^(\d{1,3})\s+(.+)$")]
    private static partial Regex LeadingInteger();

    // Multi-item inputs must not be quantity-normalized: which item would the
    // quantity belong to? " con " is deliberately absent — it introduces a
    // modifier ("cafe con leche"), not a second item.
    private static readonly string[] ItemSeparators =
        [" y ", " and ", ",", " + ", " e ", " with ", " mas "];

    // A leading number followed by a measure word is a weight/volume ("350 g
    // de carne"), not a serving count — the remainder would be a nonsense
    // cache key ("g de carne") whose per-unit values differ per total amount.
    private static readonly HashSet<string> MeasureWords = new(StringComparer.Ordinal)
    {
        "g", "gr", "gramo", "gramos", "gram", "grams", "kg", "kilo", "kilos",
        "ml", "mililitro", "mililitros", "milliliter", "milliliters", "cc",
        "l", "litro", "litros", "liter", "liters", "oz", "onza", "onzas",
        "lb", "libra", "libras", "mg", "cl"
    };

    private static readonly Dictionary<string, int> NumberWords = new()
    {
        // Spanish
        ["un"] = 1, ["una"] = 1, ["uno"] = 1, ["dos"] = 2, ["tres"] = 3,
        ["cuatro"] = 4, ["cinco"] = 5, ["seis"] = 6, ["siete"] = 7,
        ["ocho"] = 8, ["nueve"] = 9, ["diez"] = 10, ["once"] = 11, ["doce"] = 12,
        // English
        ["a"] = 1, ["an"] = 1, ["one"] = 1, ["two"] = 2, ["three"] = 3,
        ["four"] = 4, ["five"] = 5, ["six"] = 6, ["seven"] = 7,
        ["eight"] = 8, ["nine"] = 9, ["ten"] = 10, ["eleven"] = 11, ["twelve"] = 12,
    };

    /// <summary>
    /// Input must already be canonicalized by <c>AiCacheKey.NormalizeText</c>.
    /// Returns null when the phrase is multi-item, carries embedded numbers
    /// ("pan de 50g" — the number is part of the food, not a count), or uses a
    /// non-integer quantity.
    /// </summary>
    public static (int Qty, string Remainder)? TryNormalize(string normalizedText)
    {
        if (string.IsNullOrWhiteSpace(normalizedText))
            return null;

        foreach (var separator in ItemSeparators)
        {
            if (normalizedText.Contains(separator, StringComparison.Ordinal))
                return null;
        }

        // "2 huevos" → (2, "huevos")
        var match = LeadingInteger().Match(normalizedText);
        if (match.Success)
        {
            var remainder = match.Groups[2].Value;
            if (ContainsDigit(remainder) || StartsWithMeasureWord(remainder))
                return null;
            var qty = int.Parse(match.Groups[1].Value);
            return qty > 0 ? (qty, remainder) : null;
        }

        // "dos huevos" → (2, "huevos")
        var firstSpace = normalizedText.IndexOf(' ');
        if (firstSpace > 0 &&
            NumberWords.TryGetValue(normalizedText[..firstSpace], out var wordQty))
        {
            var remainder = normalizedText[(firstSpace + 1)..];
            if (remainder.Length > 0 && !ContainsDigit(remainder))
                return (wordQty, remainder);
            return null;
        }

        // "huevos" → (1, "huevos"): no stated quantity means one unit, which
        // lets an unquantified first log seed the entry that "2 huevos" hits.
        if (!ContainsDigit(normalizedText))
            return (1, normalizedText);

        return null;
    }

    private static bool StartsWithMeasureWord(string s)
    {
        var firstSpace = s.IndexOf(' ');
        var firstWord = firstSpace > 0 ? s[..firstSpace] : s;
        return MeasureWords.Contains(firstWord);
    }

    private static bool ContainsDigit(string s)
    {
        foreach (var c in s)
        {
            if (char.IsAsciiDigit(c))
                return true;
        }
        return false;
    }
}
