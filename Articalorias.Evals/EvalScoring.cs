using System.Globalization;
using System.Text;
using Articalorias.DTOs.ActivityParsing;
using Articalorias.DTOs.FoodParsing;

namespace Articalorias.Evals;

/// <summary>
/// Pure-code scoring — no LLM judges. Nutrition extraction is numeric enough
/// that tolerance checks beat a judge on both cost and reliability.
/// </summary>
public static class EvalScoring
{
    public static CaseResult ScoreFood(FoodCase c, IReadOnlyList<ParsedFoodItem> items)
    {
        var failures = new List<string>();

        if (items.Count < c.MinItems || items.Count > c.MaxItems)
            failures.Add($"item count {items.Count} outside [{c.MinItems},{c.MaxItems}]");

        if (c.TotalKcal.HasValue)
        {
            var total = items.Sum(i => i.CaloriesKcal);
            var tolerance = c.TotalKcal.Value * c.TotalKcalTolerancePct / 100m;
            if (Math.Abs(total - c.TotalKcal.Value) > tolerance)
                failures.Add($"total kcal {total} not within {c.TotalKcal}±{tolerance:0}");
        }

        var unmatched = items.ToList();
        foreach (var expect in c.Expect)
        {
            var item = unmatched.FirstOrDefault(i => MatchesName(i.FoodName, expect.NameContains));
            if (item is null)
            {
                failures.Add($"no item matching [{string.Join("|", expect.NameContains)}] " +
                             $"(got: {string.Join(", ", items.Select(i => i.FoodName))})");
                continue;
            }
            unmatched.Remove(item);

            if (expect.Kcal.HasValue)
            {
                var tolerance = expect.Kcal.Value * expect.KcalTolerancePct / 100m;
                if (Math.Abs(item.CaloriesKcal - expect.Kcal.Value) > tolerance)
                    failures.Add($"{item.FoodName}: kcal {item.CaloriesKcal} not within {expect.Kcal}±{tolerance:0}");
            }
            if (expect.KcalMin.HasValue && item.CaloriesKcal < expect.KcalMin.Value)
                failures.Add($"{item.FoodName}: kcal {item.CaloriesKcal} < min {expect.KcalMin}");
            if (expect.KcalMax.HasValue && item.CaloriesKcal > expect.KcalMax.Value)
                failures.Add($"{item.FoodName}: kcal {item.CaloriesKcal} > max {expect.KcalMax}");

            CheckMacro(failures, item.FoodName, "prot", item.ProteinGrams, expect.Prot, expect.MacroToleranceGrams);
            CheckMacro(failures, item.FoodName, "fat", item.FatGrams, expect.Fat, expect.MacroToleranceGrams);
            CheckMacro(failures, item.FoodName, "carb", item.CarbsGrams, expect.Carb, expect.MacroToleranceGrams);

            if (expect.AlcoholMin.HasValue && item.AlcoholGrams < expect.AlcoholMin.Value)
                failures.Add($"{item.FoodName}: alcohol {item.AlcoholGrams}g < min {expect.AlcoholMin}g");
        }

        return Result(c.Id, c.Input, failures,
            string.Join("; ", items.Select(i => $"{i.FoodName} x{i.Quantity}: {i.CaloriesKcal}kcal P{i.ProteinGrams} F{i.FatGrams} C{i.CarbsGrams} A{i.AlcoholGrams}")));
    }

    public static CaseResult ScoreActivity(ActivityCase c, IReadOnlyList<ParsedActivityItem> items)
    {
        var failures = new List<string>();

        if (items.Count < c.MinItems || items.Count > c.MaxItems)
            failures.Add($"item count {items.Count} outside [{c.MinItems},{c.MaxItems}]");

        var unmatched = items.ToList();
        foreach (var expect in c.Expect)
        {
            var item = expect.NameEmpty == true
                ? unmatched.FirstOrDefault(i => string.IsNullOrWhiteSpace(i.ActivityName))
                : unmatched.FirstOrDefault(i => MatchesName(i.ActivityName, expect.NameContains));

            if (item is null)
            {
                var wanted = expect.NameEmpty == true ? "<unnamed>" : string.Join("|", expect.NameContains);
                failures.Add($"no item matching [{wanted}] " +
                             $"(got: {string.Join(", ", items.Select(i => $"'{i.ActivityName}'"))})");
                continue;
            }
            unmatched.Remove(item);

            var label = string.IsNullOrWhiteSpace(item.ActivityName) ? "<unnamed>" : item.ActivityName;

            if (expect.DurationNull == true && item.DurationMinutes is not null)
                failures.Add($"{label}: duration should be null, got {item.DurationMinutes}");
            if (expect.DurationMinutes.HasValue && item.DurationMinutes != expect.DurationMinutes.Value)
                failures.Add($"{label}: duration {item.DurationMinutes?.ToString() ?? "null"} != {expect.DurationMinutes}");

            if (expect.MetNull == true && item.MetValue is not null)
                failures.Add($"{label}: met should be null, got {item.MetValue}");
            if (expect.MetMin.HasValue && (item.MetValue is null || item.MetValue < expect.MetMin.Value))
                failures.Add($"{label}: met {item.MetValue?.ToString() ?? "null"} < min {expect.MetMin}");
            if (expect.MetMax.HasValue && (item.MetValue is null || item.MetValue > expect.MetMax.Value))
                failures.Add($"{label}: met {item.MetValue?.ToString() ?? "null"} > max {expect.MetMax}");

            if (expect.KcalNull == true && item.CaloriesKcal is not null)
                failures.Add($"{label}: kcal should be null, got {item.CaloriesKcal}");
            if (expect.Kcal.HasValue && item.CaloriesKcal != expect.Kcal.Value)
                failures.Add($"{label}: kcal {item.CaloriesKcal?.ToString() ?? "null"} != {expect.Kcal} (user-stated must round-trip exactly)");
        }

        return Result(c.Id, c.Input, failures,
            string.Join("; ", items.Select(i => $"'{i.ActivityName}' min={i.DurationMinutes?.ToString() ?? "null"} met={i.MetValue?.ToString() ?? "null"} kcal={i.CaloriesKcal?.ToString() ?? "null"}")));
    }

    public static CaseResult ScoreMet(MetCase c, EstimateMetResponse response)
    {
        var failures = new List<string>();
        if (response.MetValue < c.MetMin || response.MetValue > c.MetMax)
            failures.Add($"met {response.MetValue} outside [{c.MetMin},{c.MetMax}]");

        return Result(c.Id, c.Input, failures, $"met={response.MetValue} ({response.Explanation})");
    }

    private static void CheckMacro(List<string> failures, string name, string macro, decimal actual, decimal? expected, decimal tolerance)
    {
        if (expected.HasValue && Math.Abs(actual - expected.Value) > tolerance)
            failures.Add($"{name}: {macro} {actual}g not within {expected}±{tolerance}g");
    }

    private static CaseResult Result(string id, string input, List<string> failures, string raw) => new()
    {
        Id = id,
        Input = input,
        Passed = failures.Count == 0,
        Failures = failures,
        RawResult = raw
    };

    /// <summary>Case- and accent-insensitive contains ("natación" matches "natacion").</summary>
    private static bool MatchesName(string? name, List<string> needles)
    {
        if (string.IsNullOrWhiteSpace(name) || needles.Count == 0)
            return false;
        var haystack = Fold(name);
        return needles.Any(n => haystack.Contains(Fold(n), StringComparison.Ordinal));
    }

    private static string Fold(string s)
    {
        var formD = s.ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(formD.Length);
        foreach (var ch in formD)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
                sb.Append(ch);
        }
        return sb.ToString();
    }
}
