using Articalorias.DTOs.FoodParsing;
using OpenAI.Chat;

namespace Articalorias.Services.Parsing;

/// <summary>
/// Strict Structured Output schemas for every parsing task. Strict mode makes
/// malformed responses impossible (no retry burn) and lets the system prompts
/// drop all output-format policing. Keys are short-but-meaningful: measured
/// with the o200k tokenizer, `"prot":` costs the same as `"p":`, so the keys
/// keep real-word semantics at zero extra cost. Numeric fields ask for whole
/// numbers (integers tokenize at 1 token vs 3 for decimals).
/// Schemas must stay byte-identical between calls — OpenAI caches the
/// compiled grammar and the prompt-cache prefix by exact content.
/// </summary>
internal static class ParsingSchemas
{
    private const string FoodBaseProperties = """
                "name": { "type": "string", "description": "Food name, same language as the user wrote" },
                "unit": { "type": "string", "description": "Portion description of ONE unit, no leading count" },
                "qty": { "type": "number", "description": "How many units the user had" },
                "kcal": { "type": "number", "description": "Calories for ONE unit only, never multiplied by qty" },
                "prot": { "type": "number", "description": "Protein grams for ONE unit" },
                "fat": { "type": "number", "description": "Fat grams for ONE unit" },
                "carb": { "type": "number", "description": "Carb grams for ONE unit" },
                "alc": { "type": "number", "description": "Alcohol grams for ONE unit" }
        """;

    private const string SugarProperty = """
                "sug": { "type": "number", "description": "Total sugar grams for ONE unit, subset of carb" }
        """;

    private const string WaterProperty = """
                "h2o": { "type": "number", "description": "Drinkable-fluid ml ONE unit contributes; 0 for solid food" }
        """;

    private const string ActivityItemSchema = """
        {
          "type": "object",
          "properties": {
            "name": { "type": "string", "description": "Activity name, same language as the user wrote; empty string if not named" },
            "min": { "type": ["number", "null"], "description": "Duration in minutes" },
            "met": { "type": ["number", "null"], "description": "Estimated MET value" },
            "kcal": { "type": ["number", "null"], "description": "ONLY calories the user explicitly stated, never estimated" }
          },
          "required": ["name", "min", "met", "kcal"],
          "additionalProperties": false
        }
        """;

    public static ChatResponseFormat FoodFormat(FoodParsingOptions options)
        => ChatResponseFormat.CreateJsonSchemaFormat(
            "food_items",
            BinaryData.FromString($$"""
                {
                  "type": "object",
                  "properties": {
                    "items": { "type": "array", "items": {{FoodItemSchema(options)}} }
                  },
                  "required": ["items"],
                  "additionalProperties": false
                }
                """),
            jsonSchemaIsStrict: true);

    public static ChatResponseFormat ActivityFormat()
        => ChatResponseFormat.CreateJsonSchemaFormat(
            "activity_items",
            BinaryData.FromString($$"""
                {
                  "type": "object",
                  "properties": {
                    "items": { "type": "array", "items": {{ActivityItemSchema}} }
                  },
                  "required": ["items"],
                  "additionalProperties": false
                }
                """),
            jsonSchemaIsStrict: true);

    /// <summary>Foods and activities in one response — one paid call, not two.</summary>
    public static ChatResponseFormat CombinedFormat()
        => ChatResponseFormat.CreateJsonSchemaFormat(
            "food_and_activity_items",
            BinaryData.FromString($$"""
                {
                  "type": "object",
                  "properties": {
                    "foods": { "type": "array", "items": {{FoodItemSchema(FoodParsingOptions.None)}} },
                    "acts": { "type": "array", "items": {{ActivityItemSchema}} }
                  },
                  "required": ["foods", "acts"],
                  "additionalProperties": false
                }
                """),
            jsonSchemaIsStrict: true);

    public static ChatResponseFormat MetFormat()
        => ChatResponseFormat.CreateJsonSchemaFormat(
            "met_estimate",
            BinaryData.FromString("""
                {
                  "type": "object",
                  "properties": {
                    "met": { "type": "number", "description": "Estimated MET value, 1 decimal place" },
                    "why": { "type": "string", "description": "One short sentence explaining the choice" }
                  },
                  "required": ["met", "why"],
                  "additionalProperties": false
                }
                """),
            jsonSchemaIsStrict: true);

    private static string FoodItemSchema(FoodParsingOptions options)
    {
        var properties = FoodBaseProperties;
        var required = """
            "name", "unit", "qty", "kcal", "prot", "fat", "carb", "alc"
            """.Trim();

        if (options.IncludeSugar)
        {
            properties += ",\n" + SugarProperty;
            required += ", \"sug\"";
        }

        if (options.IncludeWater)
        {
            properties += ",\n" + WaterProperty;
            required += ", \"h2o\"";
        }

        return $$"""
            {
              "type": "object",
              "properties": {
            {{properties}}
              },
              "required": [{{required}}],
              "additionalProperties": false
            }
            """;
    }
}
