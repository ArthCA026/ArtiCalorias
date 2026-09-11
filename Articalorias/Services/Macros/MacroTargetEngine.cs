using System.Text.Json;
using System.Text.Json.Serialization;
using Articalorias.Models.Entities;

namespace Articalorias.Services.Macros;

/// <summary>One tracked macro as frozen onto a DailyLog (short JSON names keep the column small).</summary>
public sealed class DayMacroTarget
{
    [JsonPropertyName("k")] public string Key { get; set; } = string.Empty;

    /// <summary>Amount in the macro unit. Null = tracked but no target: show the amount only.</summary>
    [JsonPropertyName("t")] public decimal? Target { get; set; }

    [JsonPropertyName("d")] public string Direction { get; set; } = "hit";
}

/// <summary>
/// Turns the user's preferences plus profile into the per-day frozen targets
/// (protein included) and answers "what would the target be right now" for
/// the settings screens. Snapshot rule: written on day creation and by
/// refresh-snapshot only, so past days keep the targets they were lived under.
/// </summary>
public static class MacroTargetEngine
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static bool IsTracked(MacroDefinition def, UserMacroPreference? pref)
        => pref?.IsTracked ?? def.DefaultTracked;

    public static IReadOnlyList<DayMacroTarget> BuildDayTargets(UserProfile? profile, IEnumerable<UserMacroPreference> prefs)
    {
        var context = new Context(profile, prefs);
        var targets = new List<DayMacroTarget>();

        foreach (var def in MacroCatalog.Active)
        {
            if (!IsTracked(def, context.PrefFor(def.Key)))
                continue;

            targets.Add(new DayMacroTarget
            {
                Key = def.Key,
                Target = context.EffectiveTargetOf(def.Key),
                Direction = def.DirectionCode,
            });
        }

        return targets;
    }

    /// <summary>Null when nothing is tracked, so an untouched day stores exactly what it stored before.</summary>
    public static string? BuildJson(UserProfile? profile, IEnumerable<UserMacroPreference> prefs)
    {
        var targets = BuildDayTargets(profile, prefs);
        return targets.Count == 0 ? null : JsonSerializer.Serialize(targets, JsonOptions);
    }

    /// <summary>
    /// Tolerant reader: unknown keys are dropped, retired keys are kept (their
    /// history still renders), and the list comes back in catalog order even
    /// for legacy rows where the migration appended protein last.
    /// </summary>
    public static IReadOnlyList<DayMacroTarget> ParseJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return [];

        try
        {
            var parsed = JsonSerializer.Deserialize<List<DayMacroTarget>>(json, JsonOptions) ?? [];
            return parsed
                .Where(t => !string.IsNullOrEmpty(t.Key) && MacroCatalog.IsKnown(t.Key))
                .GroupBy(t => t.Key, StringComparer.Ordinal)
                .Select(g => g.First())
                .OrderBy(t => MacroCatalog.IndexOf(t.Key))
                .ToList();
        }
        catch (JsonException)
        {
            return [];
        }
    }

    public static decimal? AutoTarget(MacroDefinition def, UserProfile? profile, IEnumerable<UserMacroPreference> prefs)
        => new Context(profile, prefs).AutoTargetOf(def.Key);

    public static decimal? EffectiveTarget(MacroDefinition def, UserProfile? profile, IEnumerable<UserMacroPreference> prefs)
        => new Context(profile, prefs).EffectiveTargetOf(def.Key);

    /// <summary>Memoized formula evaluation with a recursion guard (carbs asks about protein and fat).</summary>
    private sealed class Context : IFormulaContext
    {
        private readonly UserProfile? _profile;
        private readonly Dictionary<string, UserMacroPreference> _prefs;
        private readonly Dictionary<string, decimal?> _auto = new(StringComparer.Ordinal);
        private readonly HashSet<string> _evaluating = new(StringComparer.Ordinal);

        public Context(UserProfile? profile, IEnumerable<UserMacroPreference> prefs)
        {
            _profile = profile;
            _prefs = new Dictionary<string, UserMacroPreference>(StringComparer.Ordinal);
            foreach (var pref in prefs)
                _prefs[pref.MacroKey] = pref;
        }

        public UserMacroPreference? PrefFor(string key)
            => _prefs.TryGetValue(key, out var pref) ? pref : null;

        public decimal? AutoTargetOf(string key)
        {
            if (!MacroCatalog.TryGet(key, out var def))
                return null;
            if (_auto.TryGetValue(key, out var cached))
                return cached;
            if (!_evaluating.Add(key))
                return null; // a formula cycle would loop forever; treat as unknown

            var pref = PrefFor(key);
            var result = MacroFormulas.Evaluate(def, _profile, pref?.AutoParam ?? def.DefaultAutoParam, this);

            _evaluating.Remove(key);
            _auto[key] = result;
            return result;
        }

        public decimal? EffectiveTargetOf(string key)
        {
            if (!MacroCatalog.TryGet(key, out var def))
                return null;

            var pref = PrefFor(key);
            if (!IsTracked(def, pref))
                return null;

            return pref?.TargetMode == "custom"
                ? pref.CustomTargetValue
                : AutoTargetOf(key);
        }
    }
}
