using System.Text.Json;
using System.Text.Json.Serialization;
using Articalorias.Models.Entities;

namespace Articalorias.Services;

/// <summary>
/// The macro-target engine for the OPTIONAL macros (carbs, fat, alcohol,
/// sugar, water). Protein is deliberately excluded: its goal lives on
/// UserProfile with its own established snapshot pipeline.
///
/// Auto targets derive from the profile the same way the onboarding preview
/// does (maintenance ≈ BMR + 4.8 kcal/kg of NEAT-and-idle, plus the goal):
///   fat    30% of the calorie budget at 9 kcal/g
///   carbs  what remains after protein and fat at 4 kcal/g
///   sugar  10% of the budget at 4 kcal/g, capped at the WHO 50 g guidance
///   water  35 ml per kg of body weight, rounded to 50 ml
///   alcohol has NO auto formula: a limit only exists when the user sets one.
///
/// "Direction" tells the UI how to read the bar: "hit" macros (carbs, fat,
/// water) are goals to reach, "limit" macros (sugar, alcohol) warn when
/// exceeded.
/// </summary>
public static class MacroTargets
{
    public const string Carbs = "carbs";
    public const string Fat = "fat";
    public const string Alcohol = "alcohol";
    public const string Sugar = "sugar";
    public const string Water = "water";

    public static readonly string[] OptionalMacroKeys = [Carbs, Fat, Alcohol, Sugar, Water];

    public static bool IsValidKey(string key) => OptionalMacroKeys.Contains(key);

    public static string DirectionOf(string key) =>
        key is Sugar or Alcohol ? "limit" : "hit";

    /// <summary>One tracked macro as frozen onto a DailyLog (short JSON names keep the column small).</summary>
    public sealed class DayMacroTarget
    {
        [JsonPropertyName("k")] public string Key { get; set; } = string.Empty;
        /// <summary>Grams (ml for water). Null = tracked but no target: show the amount only.</summary>
        [JsonPropertyName("t")] public decimal? Target { get; set; }
        [JsonPropertyName("d")] public string Direction { get; set; } = "hit";
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    /// <summary>
    /// Builds the JSON snapshot of the user's tracked optional macros for a new
    /// or refreshed day. Returns null when nothing beyond protein is tracked,
    /// so untouched users produce exactly the rows they produced before.
    /// </summary>
    public static string? BuildJson(UserProfile profile, IEnumerable<UserMacroPreference> preferences)
    {
        var tracked = preferences
            .Where(p => p.IsTracked && IsValidKey(p.MacroKey))
            .OrderBy(p => Array.IndexOf(OptionalMacroKeys, p.MacroKey))
            .Select(p => new DayMacroTarget
            {
                Key = p.MacroKey,
                Target = p.TargetMode == "custom" ? p.CustomTargetValue : AutoTargetFor(p.MacroKey, profile),
                Direction = DirectionOf(p.MacroKey),
            })
            .ToList();

        return tracked.Count == 0 ? null : JsonSerializer.Serialize(tracked, JsonOptions);
    }

    public static IReadOnlyList<DayMacroTarget> ParseJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return [];
        try
        {
            return JsonSerializer.Deserialize<List<DayMacroTarget>>(json, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    /// <summary>
    /// The formula value for a macro, or null when the profile cannot support
    /// it (missing weight/BMR) or the macro has no formula (alcohol).
    /// </summary>
    public static decimal? AutoTargetFor(string key, UserProfile profile)
    {
        var weight = profile.CurrentWeightKg;

        if (key == Water)
            return weight.HasValue ? Math.Round(35m * weight.Value / 50m) * 50m : null;

        if (key == Alcohol)
            return null;

        // The calorie-derived formulas need an intake budget estimate.
        if (!weight.HasValue || profile.BMRKcal <= 0m)
            return null;

        // Same approximation the onboarding summary shows: BMR plus ~4.8 kcal/kg
        // covering NEAT, idle and sleep deltas, plus the signed goal.
        var maintenance = profile.BMRKcal + 4.8m * weight.Value;
        var budget = Math.Max(maintenance + profile.DailyBaseGoalKcal, 800m);

        switch (key)
        {
            case Fat:
                return Math.Round(budget * 0.30m / 9m);
            case Sugar:
                return Math.Min(50m, Math.Round(budget * 0.10m / 4m));
            case Carbs:
            {
                var proteinGoal = ProteinMath.GoalGrams(profile);
                var fatTarget = Math.Round(budget * 0.30m / 9m);
                var carbsKcal = budget - proteinGoal * 4m - fatTarget * 9m;
                return Math.Max(Math.Round(carbsKcal / 4m), 0m);
            }
            default:
                return null;
        }
    }
}
