using System.Text.Json;
using Articalorias.Configuration;
using Articalorias.DTOs.Favorites;
using Articalorias.DTOs.FoodParsing;
using Articalorias.Exceptions;
using Articalorias.Interfaces;
using Articalorias.Services.Parsing;
using Microsoft.Extensions.Options;
using OpenAI.Chat;

namespace Articalorias.Services;

/// <summary>
/// One-call food+activity parser for the type-agnostic favorites parse.
/// PROPOSAL GENERATOR ONLY — never writes to the database.
/// </summary>
public class CombinedParsingService : ICombinedParsingService
{
    private const string PromptVersion = "v4";
    private const string CacheType = "combined";

    private readonly IOpenAiChatExecutor _executor;
    private readonly IAiResponseCacheService _cache;
    private readonly OpenAiSettings _settings;
    private readonly ILogger<CombinedParsingService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public CombinedParsingService(
        IOpenAiChatExecutor executor,
        IAiResponseCacheService cache,
        IOptions<OpenAiSettings> settings,
        ILogger<CombinedParsingService> logger)
    {
        _executor = executor;
        _cache = cache;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<CombinedParseResult> ParseAsync(string freeText)
    {
        if (string.IsNullOrWhiteSpace(freeText))
            return new CombinedParseResult();

        if (PromptInjectionScanner.ContainsInjection(freeText))
        {
            _logger.LogWarning("Prompt injection detected in combined parse input: {Input}",
                PromptInjectionScanner.SanitizeForLog(freeText));
            throw new ApiException(ErrorCodes.InvalidInput, "Invalid input.");
        }

        var cacheKey = AiCacheKey.Compute(
            CacheType,
            PromptVersion,
            _settings.ResolveModel(_settings.FoodModel),
            AiCacheKey.NormalizeText(freeText));

        var cachedContent = await _cache.GetAsync(CacheType, cacheKey);
        if (cachedContent is not null)
        {
            var cachedResult = TryProcessResponse(cachedContent);
            if (cachedResult is not null && (cachedResult.Foods.Count > 0 || cachedResult.Activities.Count > 0))
            {
                _logger.LogInformation("Combined parse served from cache");
                return cachedResult;
            }
        }

        var messages = new List<ChatMessage>
        {
            new SystemChatMessage(CombinedSystemPrompt),
            new UserChatMessage(freeText)
        };

        string content;
        try
        {
            content = await _executor.ExecuteAsync(
                "combined-parse", _settings.FoodModel, messages, ParsingSchemas.CombinedFormat());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OpenAI API call failed for combined parse (input length {Length})", freeText.Length);
            throw new InvalidOperationException("Failed to parse the description. Try again or enter manually.");
        }

        _logger.LogInformation("OpenAI combined parse succeeded (response length {Length})", content.Length);

        var result = ProcessResponse(content);

        // Cache only useful answers; an all-empty result is a retry candidate.
        if (result.Foods.Count > 0 || result.Activities.Count > 0)
        {
            await _cache.SetAsync(CacheType, cacheKey, content,
                TimeSpan.FromDays(_settings.ParseCacheTtlDays));
        }

        return result;
    }

    // Semantics condensed from the food and activity prompts — an item goes to
    // exactly one side, and unclear text goes nowhere rather than being forced.
    private const string CombinedSystemPrompt = """
        You are an extraction engine for a calorie tracker. The user text, in Spanish or English, may describe foods or drinks consumed, physical activities performed, or both. Put foods in "foods" and activities in "acts". Either array may be empty; never force an unclear phrase into either side.

        FOOD RULES
        - Split distinct foods into separate items; aggregate repeated identical items ("3 coffees" -> one item, qty 3); preserve modifiers that affect nutrition (con leche, frito, light).
        - Do not invent foods or ingredients not implied by the text; minimal standard preparation may be inferred (fried foods include oil).
        - qty: quantity stated, else 1 — qty counts SERVINGS, never grams or milliliters. unit: describe ONE unit without a leading count, typical serving when unclear (unidad, porcion, taza, pieza, cucharada, vaso, lata, botella, rebanada). A stated weight or volume is ONE unit ("350g de carne" -> qty 1, unit "350 g", nutrition for the whole amount).
        - CRITICAL: kcal, prot, fat, carb, alc are for EXACTLY ONE unit, never multiplied by qty ("5 huevos" -> kcal 70, NOT 350). Use realistic conservative estimates consistent with Atwater factors (protein 4, carbs 4, fat 9, alcohol 7 kcal/g); use whole numbers (one decimal only below 10); never negative.
        - Alcohol: alc 0 unless alcoholic; include alcohol calories in kcal.

        ACTIVITY RULES
        - One item per distinct activity. name: activity name, "" when not named. min: duration in minutes. met: estimated MET from the Compendium of Physical Activities, 1 decimal.
        - kcal: ONLY a calorie number the user explicitly said; NEVER estimate it. When the user states calories, leave what they did not say as null (the backend does the math).
        - When calories are not stated: kcal null, estimate met, and use the stated duration or a typical one (yoga 60, running 30, weights 45).
        - Reference METs: walking 3.5, running 8.3, cycling 6.8, swimming 5.8, weights 5.0, yoga 2.5, HIIT 10.0, stretching 2.3.

        LANGUAGE
        - All names and portion texts stay in the user's language with natural casing; do not translate.
        """;

    private static CombinedParseResult ProcessResponse(string json)
    {
        WireCombinedResponse? wrapper;
        try
        {
            wrapper = JsonSerializer.Deserialize<WireCombinedResponse>(json, JsonOptions);
        }
        catch (JsonException)
        {
            throw new InvalidOperationException(
                "OpenAI returned an invalid response format. Try again or enter manually.");
        }

        var foods = (wrapper?.Foods ?? []).Select(i => i.ToParsedFoodItem()).ToList();
        var activities = (wrapper?.Acts ?? []).Select(i => i.ToParsedActivityItem()).ToList();

        return new CombinedParseResult
        {
            Foods = FoodItemSanitizer.Sanitize(foods, FoodParsingOptions.None),
            Activities = ActivityItemSanitizer.Sanitize(activities)
        };
    }

    private static CombinedParseResult? TryProcessResponse(string json)
    {
        try
        {
            return ProcessResponse(json);
        }
        catch (InvalidOperationException)
        {
            return null;
        }
    }
}
