using System.Text.Json;
using System.Text.Json.Serialization;

namespace Articalorias.Services.Macros;

/// <summary>
/// Immutable map of macro amounts keyed by catalog key, the single storage
/// shape for entries (totals eaten), templates (per 1 portion) and day totals.
///
/// Semantics: an ABSENT key means "never captured" (the macro was not tracked
/// when this was logged), a present 0 is a real measurement. Core macros are
/// always present on stored data (see <see cref="EnsureCore"/>). Keys are kept
/// in catalog order and rounded to two decimals so the serialized JSON is
/// stable and diff-friendly. Unknown keys are dropped; retired (inactive)
/// keys survive so historical rows round-trip untouched.
/// </summary>
[JsonConverter(typeof(MacroAmountsJsonConverter))]
public sealed class MacroAmounts : IEquatable<MacroAmounts>
{
    public const int StoredDecimals = 2;

    public static readonly MacroAmounts Empty = new(new Dictionary<string, decimal>(StringComparer.Ordinal));

    private static readonly JsonSerializerOptions JsonOptions = new();

    private readonly Dictionary<string, decimal> _values;

    private MacroAmounts(Dictionary<string, decimal> ordered)
    {
        _values = ordered;
    }

    public IReadOnlyDictionary<string, decimal> Values => _values;
    public int Count => _values.Count;

    public bool Has(string key) => _values.ContainsKey(key);
    public decimal? Get(string key) => _values.TryGetValue(key, out var v) ? v : null;
    public decimal GetOrZero(string key) => _values.TryGetValue(key, out var v) ? v : 0m;

    /// <summary>Builds from any pairs: unknown keys dropped, values rounded, catalog-ordered.</summary>
    public static MacroAmounts From(IEnumerable<KeyValuePair<string, decimal>> pairs)
    {
        var dict = new Dictionary<string, decimal>(StringComparer.Ordinal);
        foreach (var (key, value) in pairs)
        {
            if (key is null || !MacroCatalog.IsKnown(key))
                continue;
            dict[key] = Math.Round(value, StoredDecimals);
        }
        return Normalize(dict);
    }

    /// <summary>Request maps: null = nothing sent; core keys are always materialized as 0.</summary>
    public static MacroAmounts FromRequest(IDictionary<string, decimal>? macros)
        => (macros is null ? Empty : From(macros)).EnsureCore();

    public MacroAmounts With(string key, decimal? value)
    {
        var dict = new Dictionary<string, decimal>(_values, StringComparer.Ordinal);
        if (value.HasValue)
            dict[key] = Math.Round(value.Value, StoredDecimals);
        else
            dict.Remove(key);
        return From(dict);
    }

    /// <summary>Multiplies every amount (quantity scaling); absent keys stay absent.</summary>
    public MacroAmounts Scale(decimal ratio, int decimals)
        => From(_values.Select(kv => KeyValuePair.Create(kv.Key, Math.Round(kv.Value * ratio, decimals))));

    public MacroAmounts FilterTo(IEnumerable<string> keys)
    {
        var keep = keys.ToHashSet(StringComparer.Ordinal);
        return From(_values.Where(kv => keep.Contains(kv.Key)));
    }

    /// <summary>Adds a 0 for every active core macro that is missing.</summary>
    public MacroAmounts EnsureCore()
    {
        if (MacroCatalog.Core.All(d => _values.ContainsKey(d.Key)))
            return this;

        var dict = new Dictionary<string, decimal>(_values, StringComparer.Ordinal);
        foreach (var def in MacroCatalog.Core)
            dict.TryAdd(def.Key, 0m);
        return Normalize(dict);
    }

    /// <summary>Clamps every child macro to its parent when both are present (sugar never exceeds carbs).</summary>
    public MacroAmounts ApplyParentCeilings()
    {
        Dictionary<string, decimal>? dict = null;
        foreach (var def in MacroCatalog.All)
        {
            if (def.ParentKey is null || !_values.TryGetValue(def.Key, out var child))
                continue;
            if (!_values.TryGetValue(def.ParentKey, out var parent) || child <= parent)
                continue;
            dict ??= new Dictionary<string, decimal>(_values, StringComparer.Ordinal);
            dict[def.Key] = parent;
        }
        return dict is null ? this : Normalize(dict);
    }

    /// <summary>
    /// Day-total semantics: a key is present in the sum iff ANY item carries it,
    /// and absent items count as 0 for that key. So a day where only some
    /// entries tracked water still reports water, while a day where none did
    /// honestly reports nothing.
    /// </summary>
    public static MacroAmounts Sum(IEnumerable<MacroAmounts> items)
    {
        var dict = new Dictionary<string, decimal>(StringComparer.Ordinal);
        foreach (var item in items)
        {
            foreach (var (key, value) in item._values)
                dict[key] = dict.TryGetValue(key, out var acc) ? acc + value : value;
        }
        return Normalize(dict);
    }

    public string ToJson() => JsonSerializer.Serialize(_values, JsonOptions);

    /// <summary>Tolerant: null, empty, malformed or non-object JSON becomes <see cref="Empty"/>.</summary>
    public static MacroAmounts FromJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return Empty;
        try
        {
            var dict = JsonSerializer.Deserialize<Dictionary<string, decimal>>(json, JsonOptions);
            return dict is null ? Empty : From(dict);
        }
        catch (JsonException)
        {
            return Empty;
        }
    }

    public Dictionary<string, decimal> ToDictionary() => new(_values, StringComparer.Ordinal);

    private static MacroAmounts Normalize(Dictionary<string, decimal> dict)
    {
        var ordered = new Dictionary<string, decimal>(dict.Count, StringComparer.Ordinal);
        foreach (var kv in dict.OrderBy(kv => MacroCatalog.IndexOf(kv.Key)).ThenBy(kv => kv.Key, StringComparer.Ordinal))
            ordered[kv.Key] = Math.Round(kv.Value, StoredDecimals);
        return new MacroAmounts(ordered);
    }

    public bool Equals(MacroAmounts? other)
    {
        if (other is null) return false;
        if (ReferenceEquals(this, other)) return true;
        if (_values.Count != other._values.Count) return false;
        foreach (var (key, value) in _values)
        {
            if (!other._values.TryGetValue(key, out var v) || v != value)
                return false;
        }
        return true;
    }

    public override bool Equals(object? obj) => Equals(obj as MacroAmounts);

    public override int GetHashCode()
    {
        var hash = new HashCode();
        foreach (var (key, value) in _values.OrderBy(kv => kv.Key, StringComparer.Ordinal))
        {
            hash.Add(key, StringComparer.Ordinal);
            hash.Add(value);
        }
        return hash.ToHashCode();
    }

    public override string ToString() => ToJson();
}

/// <summary>
/// System.Text.Json shape: a plain object {"protein":12.5,"fat":3}. Used by
/// every API DTO that exposes a <see cref="MacroAmounts"/> and by the GDPR
/// export, which serializes entities directly.
/// </summary>
public sealed class MacroAmountsJsonConverter : JsonConverter<MacroAmounts>
{
    public override MacroAmounts Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null)
            return MacroAmounts.Empty;
        var dict = JsonSerializer.Deserialize<Dictionary<string, decimal>>(ref reader, options);
        return dict is null ? MacroAmounts.Empty : MacroAmounts.From(dict);
    }

    public override void Write(Utf8JsonWriter writer, MacroAmounts value, JsonSerializerOptions options)
    {
        writer.WriteStartObject();
        foreach (var (key, amount) in value.Values)
            writer.WriteNumber(key, amount);
        writer.WriteEndObject();
    }
}
