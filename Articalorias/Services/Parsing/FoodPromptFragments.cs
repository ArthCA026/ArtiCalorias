using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using Articalorias.DTOs.FoodParsing;
using Articalorias.Services.Macros;

namespace Articalorias.Services.Parsing;

/// <summary>
/// The catalog-generated parts of the food extraction contract, shared by the
/// text, vision and combined parsers so the three can never drift: the core
/// wire-key sentence, the Atwater sentence, the per-macro "additional tracked
/// fields" block and the strict item schema. Everything is built once (or
/// once per option set) into byte-stable strings, which is what keeps the
/// OpenAI prompt-cache prefix and compiled-grammar cache warm.
/// </summary>
internal static class FoodPromptFragments
{
    private static readonly ConcurrentDictionary<string, string> SchemaCache = new(StringComparer.Ordinal);

    /// <summary>"kcal, prot, fat, carb and alc" — the always-present numeric keys.</summary>
    public static string CoreWireKeys { get; } = JoinWithAnd(
        new[] { "kcal" }.Concat(MacroCatalog.Core.Select(d => d.AiWireKey)).ToList());

    /// <summary>"protein 4 kcal/g, fat 9 kcal/g, carbs 4 kcal/g, alcohol 7 kcal/g".</summary>
    public static string AtwaterSentence { get; } = string.Join(", ",
        MacroCatalog.Core
            .Where(d => d.KcalPerGram > 0m)
            .Select(d => $"{d.Name.En.ToLowerInvariant()} {d.KcalPerGram:0.#} kcal/g"));

    /// <summary>Empty when nothing optional is tracked, so default users keep a stable prompt.</summary>
    public static string AdditionalTrackedFieldsBlock(FoodParsingOptions options)
    {
        if (options.OptionalDefinitions.Count == 0)
            return string.Empty;

        var sb = new StringBuilder();
        sb.Append("\n\nADDITIONAL TRACKED FIELDS (the user tracks these; include them on EVERY item)");
        foreach (var def in options.OptionalDefinitions)
            sb.Append('\n').Append("- ").Append(def.AiWireKey).Append(": ").Append(def.AiPromptRule);
        return sb.ToString();
    }

    /// <summary>Strict JSON schema for one food item: base fields, core macros, then the tracked optional ones.</summary>
    public static string FoodItemSchema(FoodParsingOptions options)
        => SchemaCache.GetOrAdd(options.CacheToken, _ => BuildFoodItemSchema(options));

    private static string BuildFoodItemSchema(FoodParsingOptions options)
    {
        var properties = new List<string>
        {
            Property("name", "string", "Food name, same language as the user wrote"),
            Property("unit", "string", "Portion description of ONE unit, no leading count"),
            Property("qty", "number", "How many units the user had"),
            Property("kcal", "number", "Calories for ONE unit only, never multiplied by qty"),
        };
        var required = new List<string> { "name", "unit", "qty", "kcal" };

        foreach (var def in MacroCatalog.Core.Concat(options.OptionalDefinitions))
        {
            properties.Add(Property(def.AiWireKey, "number", def.AiSchemaDescription));
            required.Add(def.AiWireKey);
        }

        var sb = new StringBuilder();
        sb.Append("{\n  \"type\": \"object\",\n  \"properties\": {\n");
        sb.Append(string.Join(",\n", properties.Select(p => "    " + p)));
        sb.Append("\n  },\n  \"required\": [");
        sb.Append(string.Join(", ", required.Select(r => JsonSerializer.Serialize(r))));
        sb.Append("],\n  \"additionalProperties\": false\n}");
        return sb.ToString();
    }

    private static string Property(string name, string type, string description)
        => $"{JsonSerializer.Serialize(name)}: {{ \"type\": \"{type}\", \"description\": {JsonSerializer.Serialize(description)} }}";

    private static string JoinWithAnd(IReadOnlyList<string> parts)
        => parts.Count <= 1
            ? string.Join("", parts)
            : string.Join(", ", parts.Take(parts.Count - 1)) + " and " + parts[^1];
}
