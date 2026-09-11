using System.ComponentModel.DataAnnotations;

namespace Articalorias.Services.Macros;

/// <summary>
/// Catalog-driven validation for the macro maps on request DTOs. Wired
/// through <see cref="IValidatableObject"/> so [ApiController] turns every
/// finding into a 400 ValidationProblemDetails keyed "macros.&lt;key&gt;".
/// </summary>
public static class MacroInputValidator
{
    public static IEnumerable<ValidationResult> Validate(IDictionary<string, decimal>? macros, string memberPrefix = "macros")
    {
        if (macros is null)
            yield break;

        if (macros.Count > MacroCatalog.All.Count)
        {
            yield return new ValidationResult("Too many macro keys.", [memberPrefix]);
            yield break;
        }

        foreach (var (key, value) in macros)
        {
            if (string.IsNullOrEmpty(key) || !MacroCatalog.IsAcceptedInput(key))
            {
                yield return new ValidationResult($"Unknown or inactive macro key '{key}'.", [$"{memberPrefix}.{key}"]);
                continue;
            }

            var def = MacroCatalog.ByKey[key];
            if (value < 0m || value > def.MaxPerEntry)
            {
                yield return new ValidationResult(
                    $"'{key}' must be between 0 and {def.MaxPerEntry:0.##} {def.UnitCode}.",
                    [$"{memberPrefix}.{key}"]);
            }
        }

        // A subset can never exceed what it is part of (sugar within carbs). AI
        // and label data are clamped silently; typed input is reported so the
        // user sees which number is off.
        foreach (var (key, value) in macros)
        {
            if (!MacroCatalog.TryGet(key, out var def) || def.ParentKey is null)
                continue;
            if (macros.TryGetValue(def.ParentKey, out var parent) && value > parent)
            {
                yield return new ValidationResult(
                    $"'{key}' cannot exceed '{def.ParentKey}'.",
                    [$"{memberPrefix}.{key}"]);
            }
        }
    }
}
