using System.Text.Json;
using Articalorias.Configuration;
using Articalorias.DTOs.ActivityParsing;
using Articalorias.Exceptions;
using Articalorias.Interfaces;
using Articalorias.Services.Parsing;
using Microsoft.Extensions.Options;
using OpenAI.Chat;

namespace Articalorias.Services;

/// <summary>
/// Parses free-text activity descriptions via OpenAI.
/// This service is a PROPOSAL GENERATOR ONLY.
/// It never writes to the database.
/// The user reviews, edits, and confirms before anything is persisted.
/// </summary>
public class ActivityParsingService : IActivityParsingService
{
    /// <summary>Bump when a prompt or wire schema changes (invalidates cache).</summary>
    private const string PromptVersion = "v2";

    private const string ParseCacheType = "activity";
    private const string MetCacheType = "met";

    private readonly IOpenAiChatExecutor _executor;
    private readonly IAiResponseCacheService _cache;
    private readonly OpenAiSettings _settings;
    private readonly ILogger<ActivityParsingService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public ActivityParsingService(
        IOpenAiChatExecutor executor,
        IAiResponseCacheService cache,
        IOptions<OpenAiSettings> settings,
        ILogger<ActivityParsingService> logger)
    {
        _executor = executor;
        _cache = cache;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<IReadOnlyList<ParsedActivityItem>> ParseFreeTextAsync(string freeText)
    {
        if (string.IsNullOrWhiteSpace(freeText))
            return [];

        if (PromptInjectionScanner.ContainsInjection(freeText))
        {
            _logger.LogWarning("Prompt injection detected in activity free-text input: {Input}",
                PromptInjectionScanner.SanitizeForLog(freeText));
            throw new ApiException(ErrorCodes.InvalidInput, "Invalid input.");
        }

        var cacheKey = AiCacheKey.Compute(
            ParseCacheType,
            PromptVersion,
            _settings.ResolveModel(_settings.ActivityModel),
            AiCacheKey.NormalizeText(freeText));

        var cachedContent = await _cache.GetAsync(ParseCacheType, cacheKey);
        if (cachedContent is not null)
        {
            var cachedItems = TryProcessResponse(cachedContent);
            if (cachedItems is { Count: > 0 })
            {
                // Activity text is health data (Ley 8968): log outcome only, never content.
                _logger.LogInformation("Activity parse served from cache");
                return cachedItems;
            }
        }

        var messages = new List<ChatMessage>
        {
            new SystemChatMessage(ActivityParseSystemPrompt),
            new UserChatMessage(freeText)
        };

        string content;
        try
        {
            content = await _executor.ExecuteAsync(
                "activity-parse", _settings.ActivityModel, messages, ParsingSchemas.ActivityFormat());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OpenAI API call failed for activity parse (input length {Length})", freeText.Length);
            throw new InvalidOperationException("Failed to parse activity description. Try again or enter manually.");
        }

        _logger.LogInformation("OpenAI activity parse succeeded (response length {Length})", content.Length);

        var items = ProcessResponse(content);

        await _cache.SetAsync(ParseCacheType, cacheKey, content,
            TimeSpan.FromDays(_settings.ParseCacheTtlDays));

        return items;
    }

    public async Task<EstimateMetResponse> EstimateMetAsync(string activityName, decimal? durationMinutes)
    {
        if (string.IsNullOrWhiteSpace(activityName))
            throw new ArgumentException("Activity name is required.", nameof(activityName));

        if (PromptInjectionScanner.ContainsInjection(activityName))
        {
            _logger.LogWarning("Prompt injection detected in MET estimate input: {Input}",
                PromptInjectionScanner.SanitizeForLog(activityName));
            throw new ApiException(ErrorCodes.InvalidInput, "Invalid input.");
        }

        // The prompt itself demands a deterministic value per activity name and
        // tells the model to ignore duration — so duration takes no part in the
        // estimate, common activities resolve from the in-code Compendium seed,
        // and every model answer is cached forever. Marginal cost trends to zero.
        var normalizedName = AiCacheKey.NormalizeText(activityName);

        if (MetSeed.TryGetValue(normalizedName, out var seed))
        {
            return new EstimateMetResponse
            {
                ActivityName = activityName,
                MetValue = seed.Met,
                Explanation = seed.Spanish
                    ? "Valor MET de referencia del Compendio de Actividades Físicas."
                    : "Reference MET value from the Compendium of Physical Activities."
            };
        }

        var cacheKey = AiCacheKey.Compute(
            MetCacheType,
            PromptVersion,
            _settings.ResolveModel(_settings.MetModel),
            normalizedName);

        var cachedContent = await _cache.GetAsync(MetCacheType, cacheKey);
        if (cachedContent is not null)
        {
            var cachedResponse = TryProcessMetResponse(cachedContent, activityName);
            if (cachedResponse is not null)
            {
                _logger.LogInformation("MET estimate served from cache");
                return cachedResponse;
            }
        }

        var messages = new List<ChatMessage>
        {
            new SystemChatMessage(MetEstimateSystemPrompt),
            new UserChatMessage(activityName)
        };

        string content;
        try
        {
            content = await _executor.ExecuteAsync(
                "met-estimate", _settings.MetModel, messages, ParsingSchemas.MetFormat());
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OpenAI API call failed for MET estimate (name length {Length})", activityName.Length);
            throw new InvalidOperationException("Failed to estimate MET value. Try again or enter manually.");
        }

        _logger.LogInformation("OpenAI MET estimate succeeded (response length {Length})", content.Length);

        var response = ProcessMetResponse(content, activityName);

        // MET values never go stale — cache forever.
        await _cache.SetAsync(MetCacheType, cacheKey, content, ttl: null);

        return response;
    }

    // ─────────────────────────────────────────────────────
    //  Static MET seed — top activities never touch OpenAI
    // ─────────────────────────────────────────────────────

    // Values follow the Compendium of Physical Activities at moderate
    // intensity, consistent with the anchors in the prompts below.
    private static readonly Dictionary<string, (decimal Met, bool Spanish)> MetSeed = new()
    {
        // English
        ["walking"] = (3.5m, false),
        ["walk"] = (3.5m, false),
        ["running"] = (8.3m, false),
        ["run"] = (8.3m, false),
        ["jogging"] = (7.0m, false),
        ["cycling"] = (6.8m, false),
        ["biking"] = (6.8m, false),
        ["swimming"] = (5.8m, false),
        ["weight training"] = (5.0m, false),
        ["weightlifting"] = (5.0m, false),
        ["lifting"] = (5.0m, false),
        ["gym"] = (5.0m, false),
        ["workout"] = (5.0m, false),
        ["exercise"] = (5.0m, false),
        ["yoga"] = (2.5m, false),
        ["hiit"] = (10.0m, false),
        ["stretching"] = (2.3m, false),
        ["dancing"] = (5.5m, false),
        ["basketball"] = (6.5m, false),
        ["soccer"] = (7.0m, false),
        ["football"] = (7.0m, false),
        ["tennis"] = (7.3m, false),
        ["hiking"] = (6.0m, false),
        ["pilates"] = (3.0m, false),
        ["crossfit"] = (10.0m, false),
        ["elliptical"] = (5.0m, false),
        ["rowing"] = (7.0m, false),
        ["spinning"] = (8.5m, false),
        ["boxing"] = (7.8m, false),
        ["climbing"] = (8.0m, false),
        ["zumba"] = (6.5m, false),
        // Spanish
        ["caminar"] = (3.5m, true),
        ["caminata"] = (3.5m, true),
        ["correr"] = (8.3m, true),
        ["trotar"] = (7.0m, true),
        ["ciclismo"] = (6.8m, true),
        ["bicicleta"] = (6.8m, true),
        ["natación"] = (5.8m, true),
        ["natacion"] = (5.8m, true),
        ["nadar"] = (5.8m, true),
        ["pesas"] = (5.0m, true),
        ["gimnasio"] = (5.0m, true),
        ["ejercicio"] = (5.0m, true),
        ["estiramiento"] = (2.3m, true),
        ["baile"] = (5.5m, true),
        ["bailar"] = (5.5m, true),
        ["baloncesto"] = (6.5m, true),
        ["básquetbol"] = (6.5m, true),
        ["basquetbol"] = (6.5m, true),
        ["fútbol"] = (7.0m, true),
        ["futbol"] = (7.0m, true),
        ["tenis"] = (7.3m, true),
        ["senderismo"] = (6.0m, true),
        ["escalada"] = (8.0m, true),
        ["remo"] = (7.0m, true),
        ["boxeo"] = (7.8m, true),
    };

    // ─────────────────────────────────────────────────────
    //  Prompts
    // ─────────────────────────────────────────────────────

    // Output-format policing lives in the strict JSON schema; these prompts
    // carry only the tuned extraction semantics.
    private const string ActivityParseSystemPrompt = """
        You are a fitness and exercise assistant. The user describes activities they performed in free text, in Spanish or English. Parse each distinct activity into a separate item (activities may be joined by "and", "y", commas, or similar separators).

        FIELDS
        - n: activity name in the same language as the user's input; preserve natural casing ("CrossFit", "Pilates"); do not translate; empty string "" when the user did not name the activity.
        - min: duration in minutes (convert other units to minutes).
        - met: estimated MET value, rounded to 1 decimal place.
        - kcal: calories burned, ONLY if the user explicitly stated them ("200 kcal", "burned 350 calories", "queme 200 kcal").

        The user may report calories from a smart watch. Extraction rules for that case — follow them exactly:
        - kcal is filled ONLY with a number the user said. NEVER estimate or calculate calories yourself.
        - When the user states calories, NEVER calculate the missing duration or MET from them. Leave what the user did not say as null. The backend does that math.
        - "200kcal of running" -> n "running" (keep user language), met estimated from the activity name, min null, kcal 200.
        - "200kcal in 20min" -> n "", min 20, met null, kcal 200.
        - "200kcal of running in 20min" -> n "running", min 20, met null (the backend derives the real MET from calories and duration), kcal 200.
        - "200kcal" alone -> n "", min null, met null, kcal 200.

        When the user does NOT state calories (the normal case), kcal is null and:
        - met: estimate a reasonable MET value based on the Compendium of Physical Activities; if the activity is too vague, use the most reasonable common estimate for that label.
        - min: if the user stated it, use their value; otherwise estimate a typical duration (aerobics class 45, yoga 60, running 30, weight training 45, stretching 15).

        Reference MET examples: walking moderate 3.5, running 8 km/h 8.3, cycling moderate 6.8, swimming moderate 5.8, weight training 5.0, yoga 2.5, HIIT 10.0, stretching 2.3.
        Never return negative values.

        Example: "30 min corriendo y 15 min de estiramiento" -> items: [{ n "Correr", min 30, met 8.3, kcal null }, { n "Estiramiento", min 15, met 2.3, kcal null }].
        Example: "corri y queme 320 kcal segun mi reloj" -> items: [{ n "Correr", min null, met 8.3, kcal 320 }].
        """;

    private const string MetEstimateSystemPrompt = """
            You are a fitness expert. The user provides the name of a physical activity in English or Spanish. Estimate its MET (Metabolic Equivalent of Task) value using the Compendium of Physical Activities as reference.

            - met: the estimated MET value, rounded to 1 decimal place. Use the most common/moderate intensity if intensity is not specified. Ignore duration, calories, or distance unless they clearly imply intensity. If the activity is vague ("workout", "exercise"), choose a reasonable general estimate (~5.0). Always return a deterministic value for the same input.
            - why: a single short, specific sentence explaining the choice.

            Reference anchors: sitting quietly 1.0, walking slow 2.0, walking moderate 3.5, cycling moderate 6.8, running 8 km/h 8.3, running 10 km/h 10.0, swimming moderate 5.8, weight training 5.0, yoga 2.5, HIIT 10.0, stretching 2.3, dancing 5.5, basketball 6.5, soccer 7.0.
            """;

    // ─────────────────────────────────────────────────────
    //  Response processing
    // ─────────────────────────────────────────────────────

    private static IReadOnlyList<ParsedActivityItem> ProcessResponse(string json)
    {
        List<ParsedActivityItem> items;
        try
        {
            var wrapper = JsonSerializer.Deserialize<WireActivityResponse>(json, JsonOptions);
            items = (wrapper?.Items ?? []).Select(i => i.ToParsedActivityItem()).ToList();
        }
        catch (JsonException)
        {
            throw new InvalidOperationException(
                "OpenAI returned an invalid response format. Try again or enter manually.");
        }

        if (items.Count == 0)
            throw new InvalidOperationException("OpenAI returned no activity items. Try a more descriptive input.");

        var sanitized = ActivityItemSanitizer.Sanitize(items);

        if (sanitized.Count == 0)
            throw new InvalidOperationException("All parsed items were invalid. Try again or enter manually.");

        return sanitized;
    }

    private static IReadOnlyList<ParsedActivityItem>? TryProcessResponse(string json)
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

    private static EstimateMetResponse ProcessMetResponse(string json, string activityName)
    {
        try
        {
            var result = JsonSerializer.Deserialize<WireMetResponse>(json, JsonOptions);
            return new EstimateMetResponse
            {
                ActivityName = activityName,
                MetValue = Math.Clamp(result?.Met ?? 3.5m, 0.5m, 50m),
                Explanation = result?.Why
            };
        }
        catch (JsonException)
        {
            throw new InvalidOperationException(
                "OpenAI returned an invalid response format. Try again or enter manually.");
        }
    }

    private static EstimateMetResponse? TryProcessMetResponse(string json, string activityName)
    {
        try
        {
            return ProcessMetResponse(json, activityName);
        }
        catch (InvalidOperationException)
        {
            return null;
        }
    }
}
