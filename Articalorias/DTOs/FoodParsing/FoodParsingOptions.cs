using Articalorias.Services.Macros;

namespace Articalorias.DTOs.FoodParsing;

/// <summary>
/// Which OPTIONAL macros the AI parser should extract, derived from the
/// caller's tracked macros. Kept deliberately narrow: asking the model for
/// data nobody displays makes parsing slower, costlier and less accurate, so
/// the default (nothing extra) keeps a stable extraction contract. Core
/// macros are always parsed.
/// </summary>
public sealed class FoodParsingOptions
{
    public static readonly FoodParsingOptions None = new([]);

    public FoodParsingOptions(IEnumerable<string> optionalKeys)
    {
        var wanted = optionalKeys.ToHashSet(StringComparer.Ordinal);
        OptionalDefinitions = MacroCatalog.Optional.Where(d => wanted.Contains(d.Key)).ToList();
        OptionalKeys = OptionalDefinitions.Select(d => d.Key).ToHashSet(StringComparer.Ordinal);
        CacheToken = string.Join(",", OptionalDefinitions.Select(d => d.AiWireKey).OrderBy(k => k, StringComparer.Ordinal));
    }

    /// <summary>Tracked optional macro keys, active catalog entries only.</summary>
    public IReadOnlySet<string> OptionalKeys { get; }

    /// <summary>The same set as definitions, in catalog order.</summary>
    public IReadOnlyList<MacroDefinition> OptionalDefinitions { get; }

    /// <summary>
    /// Canonical cache-key token: the requested wire keys sorted and joined
    /// ("" | "h2o" | "caf,h2o,sug"). Order-stable, so adding a macro to the
    /// catalog never reshuffles existing keys.
    /// </summary>
    public string CacheToken { get; }

    public bool Includes(string macroKey) => OptionalKeys.Contains(macroKey);
}
