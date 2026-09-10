using System.Text.Json;
using Articalorias.Configuration;
using Articalorias.DTOs.FoodParsing;
using Articalorias.Exceptions;
using Articalorias.Interfaces;
using Articalorias.Services.Parsing;
using Microsoft.Extensions.Options;
using OpenAI.Chat;

namespace Articalorias.Services;

/// <summary>
/// Parses free-text food descriptions via OpenAI.
/// This service is a PROPOSAL GENERATOR ONLY.
/// It never writes to the database.
/// The user reviews, edits, and confirms before anything is persisted.
/// </summary>
public class FoodParsingService : IFoodParsingService
{
    /// <summary>
    /// Part of every cache key: bump whenever the prompt or wire schema
    /// changes so stale answers from the old contract can never be served.
    /// </summary>
    private const string PromptVersion = "v2";

    private const string CacheType = "food";

    private readonly IOpenAiChatExecutor _executor;
    private readonly IAiResponseCacheService _cache;
    private readonly OpenAiSettings _settings;
    private readonly ILogger<FoodParsingService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public FoodParsingService(
        IOpenAiChatExecutor executor,
        IAiResponseCacheService cache,
        IOptions<OpenAiSettings> settings,
        ILogger<FoodParsingService> logger)
    {
        _executor = executor;
        _cache = cache;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<IReadOnlyList<ParsedFoodItem>> ParseFreeTextAsync(string freeText, string? country = null, FoodParsingOptions? options = null)
    {
        if (string.IsNullOrWhiteSpace(freeText))
            return [];

        if (PromptInjectionScanner.ContainsInjection(freeText))
        {
            _logger.LogWarning("Prompt injection detected in food free-text input: {Input}",
                PromptInjectionScanner.SanitizeForLog(freeText));
            throw new ApiException(ErrorCodes.InvalidInput, "Invalid input.");
        }
        if (PromptInjectionScanner.ContainsInjection(country))
        {
            _logger.LogWarning("Prompt injection detected in food country field: {Input}",
                PromptInjectionScanner.SanitizeForLog(country!));
            throw new ApiException(ErrorCodes.InvalidInput, "Invalid input.");
        }

        var opts = options ?? FoodParsingOptions.None;

        // Identical inputs are extremely common in a calorie tracker ("2 huevos",
        // "cafe con leche") — an exact-match cache turns them into free replays.
        // The key covers everything that shapes the answer.
        var cacheKey = AiCacheKey.Compute(
            CacheType,
            PromptVersion,
            _settings.ResolveModel(_settings.FoodModel),
            country,
            opts.IncludeSugar ? "s1" : "s0",
            opts.IncludeWater ? "w1" : "w0",
            AiCacheKey.NormalizeText(freeText));

        var cachedContent = await _cache.GetAsync(CacheType, cacheKey);
        if (cachedContent is not null)
        {
            var cachedItems = TryProcessResponse(cachedContent, opts);
            if (cachedItems is { Count: > 0 })
            {
                // Meal text is health data (Ley 8968): log outcome only, never content.
                _logger.LogInformation("Food parse served from cache");
                return cachedItems;
            }
            // Corrupt or contract-stale entry — fall through to a fresh call.
        }

        var systemPrompt = BuildSystemPrompt(country, opts);
        var messages = new List<ChatMessage>
        {
            new SystemChatMessage(systemPrompt),
            new UserChatMessage(freeText)
        };

        string content;
        try
        {
            content = await _executor.ExecuteAsync(
                "food-parse", _settings.FoodModel, messages, ParsingSchemas.FoodFormat(opts));
        }
        catch (System.ClientModel.ClientResultException ex) when (ex.Status == 429)
        {
            _logger.LogError(ex, "OpenAI API quota exceeded for food parse (input length {Length})", freeText.Length);
            throw new InvalidOperationException("AI food parsing is temporarily unavailable (API quota exceeded).");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OpenAI API call failed for food parse (input length {Length})", freeText.Length);
            throw new InvalidOperationException("Failed to parse food description. Try again or enter manually.");
        }

        _logger.LogInformation("OpenAI food parse succeeded (response length {Length})", content.Length);

        var items = ProcessResponse(content, opts);

        // Only proven-good responses are worth replaying for the next user.
        await _cache.SetAsync(CacheType, cacheKey, content,
            TimeSpan.FromDays(_settings.ParseCacheTtlDays));

        return items;
    }

    // ─────────────────────────────────────────────────────
    //  Prompt — defines the contract between us and OpenAI
    // ─────────────────────────────────────────────────────

    /// <summary>
    /// Assembles the system prompt for the caller's tracked macros. The base
    /// prompt is untouched when no optional macro is tracked, so default users
    /// keep a stable extraction contract (and a stable cache-key prefix).
    /// </summary>
    private static string BuildSystemPrompt(string? country, FoodParsingOptions options)
    {
        var prompt = DeveloperPrompt;

        var extraRules = new List<string>();

        if (options.IncludeSugar)
        {
            extraRules.Add("- sug: total sugar grams for ONE unit (naturally occurring plus added), never multiplied by q. Sugars are a subset of c and must never exceed it (a can of cola ~35, a plain egg 0).");
        }

        if (options.IncludeWater)
        {
            extraRules.Add("- h2o: milliliters of drinkable fluid ONE unit contributes, never multiplied by q. Water and other beverages count at full volume (a 330 ml soda -> 330, a glass of water -> 250 unless specified); solid food is 0 even if moist.");
        }

        if (extraRules.Count > 0)
        {
            prompt += "\n\nADDITIONAL TRACKED FIELDS (the user tracks these; include them on EVERY item)\n"
                   + string.Join("\n", extraRules);
        }

        if (!string.IsNullOrWhiteSpace(country))
        {
            prompt += $"\n\nThe user is located in {country}. Use typical food products, brands, and portion sizes common in {country} when estimating calories and macros.";
        }

        return prompt;
    }

    // Output-format policing lives in the strict JSON schema now; this prompt
    // only carries the extraction semantics that were tuned on real inputs.
    private const string DeveloperPrompt = """
            You are a food-intake extraction engine. The user describes foods or drinks in Spanish or English; extract every edible or drinkable item into the schema. Produce realistic, consistent, conservative nutrition estimates based on common foods, brands, and preparation methods. If nothing edible or drinkable is described, return an empty items array.

            EXTRACTION RULES
            - Split distinct foods into separate items.
            - Aggregate repeated identical items into one entry ("3 coffees" -> one item with q 3).
            - If foods differ meaningfully (chicken taco vs beef taco), keep them separate.
            - Preserve modifiers that affect nutrition (con leche, con azucar, frito, integral, descremado, light, con alcohol).
            - If a dish clearly contains multiple core components and splitting improves accuracy, you may separate them ("arroz con pollo" -> arroz + pollo). Otherwise keep one item.
            - Do not invent side dishes, toppings, or ingredients not implied by the text; you may infer minimal standard preparation when strongly implied (fried foods include oil).

            PORTION RULES
            - q: the quantity the user stated, else 1. Integer or decimal.
            - u: describe ONE unit without a leading count ("huevo entero", "rebanada de pan"); if portion is unclear, use a typical serving. Use normalized units such as: g, ml, unidad, porcion, taza, pieza, cucharada, cucharadita, vaso, lata, botella, rebanada.

            NUTRITION RULES
            - Priority order: 1. user-provided calories/macros, 2. known product, brand, or restaurant equivalent, 3. generic food database estimates.
            - CRITICAL: kcal, p, f, c and alc are each for EXACTLY ONE unit of the food — never the total for the whole quantity. The caller multiplies by q; if you multiply, the result will be wrong.
              "5 huevos" -> kcal 70 (1 egg), NOT 350. "2 Big Macs" -> kcal 550 (1 Big Mac), NOT 1100.
            - Keep values internally consistent using Atwater factors: protein 4 kcal/g, carbs 4 kcal/g, fat 9 kcal/g, alcohol 7 kcal/g.
            - Round to 1 decimal place; never negative; if uncertainty is high, use reasonable rounded estimates instead of fake precision.
            - Supplements, medicine, and non-caloric products -> zero or negligible calories and macros.
            - Alcohol: alc is 0 for non-alcoholic items; for alcoholic drinks estimate alc from typical serving and ABV unless specified, and include alcohol calories in kcal.

            LANGUAGE RULES
            - n and u stay in the same language as the user input, with natural casing preserved ("Coca-Cola", "Big Mac"); do not translate.
            """;

    // ─────────────────────────────────────────────────────
    //  Response processing — wire JSON to validated items
    // ─────────────────────────────────────────────────────

    /// <summary>Full pipeline with user-facing errors on bad output.</summary>
    private static IReadOnlyList<ParsedFoodItem> ProcessResponse(string json, FoodParsingOptions options)
    {
        List<ParsedFoodItem> items;
        try
        {
            var wrapper = JsonSerializer.Deserialize<WireFoodResponse>(json, JsonOptions);
            items = (wrapper?.Items ?? []).Select(i => i.ToParsedFoodItem()).ToList();
        }
        catch (JsonException)
        {
            throw new InvalidOperationException(
                "OpenAI returned an invalid response format. Try again or enter manually.");
        }

        if (items.Count == 0)
            throw new InvalidOperationException("OpenAI returned no food items. Try a more descriptive input.");

        var sanitized = FoodItemSanitizer.Sanitize(items, options);

        if (sanitized.Count == 0)
            throw new InvalidOperationException("All parsed items were invalid. Try again or enter manually.");

        return sanitized;
    }

    /// <summary>Cache-replay pipeline: never throws, a bad entry is just a miss.</summary>
    private static IReadOnlyList<ParsedFoodItem>? TryProcessResponse(string json, FoodParsingOptions options)
    {
        try
        {
            return ProcessResponse(json, options);
        }
        catch (InvalidOperationException)
        {
            return null;
        }
    }

    // ─────────────────────────────────────────────────────
    //  ParseImageAsync — vision-based food parsing
    // ─────────────────────────────────────────────────────

    public async Task<IReadOnlyList<ParsedFoodItem>> ParseImageAsync(
        string imageBase64,
        string mimeType,
        string? freeText,
        string? country = null,
        FoodParsingOptions? options = null)
    {
        if (string.IsNullOrWhiteSpace(imageBase64))
            throw new ArgumentException("Image data is required.", nameof(imageBase64));

        if (PromptInjectionScanner.ContainsInjection(freeText))
        {
            _logger.LogWarning("Prompt injection detected in image food text hint: {Input}",
                PromptInjectionScanner.SanitizeForLog(freeText!));
            throw new ApiException(ErrorCodes.InvalidInput, "Invalid input.");
        }
        if (PromptInjectionScanner.ContainsInjection(country))
        {
            _logger.LogWarning("Prompt injection detected in food country field: {Input}",
                PromptInjectionScanner.SanitizeForLog(country!));
            throw new ApiException(ErrorCodes.InvalidInput, "Invalid input.");
        }

        var opts = options ?? FoodParsingOptions.None;
        var systemPrompt = BuildSystemPrompt(country, opts);

        // Decode base64 → BinaryData for the OpenAI SDK
        byte[] imageBytes;
        try
        {
            imageBytes = Convert.FromBase64String(imageBase64);
        }
        catch (FormatException)
        {
            throw new InvalidOperationException("Image data is not valid base64.");
        }

        // Image tokens scale with detail level; "low" is far cheaper but may
        // miss small items — controlled via OpenAI:VisionDetail after testing.
        var imagePart = ChatMessageContentPart.CreateImagePart(
            BinaryData.FromBytes(imageBytes),
            mimeType,
            ResolveVisionDetail());

        var textContent = string.IsNullOrWhiteSpace(freeText)
            ? "What food or drink items are in this image? Extract all visible food and provide nutritional estimates."
            : freeText;

        var textPart = ChatMessageContentPart.CreateTextPart(textContent);

        var messages = new List<ChatMessage>
        {
            new SystemChatMessage(systemPrompt),
            new UserChatMessage(imagePart, textPart),
        };

        _logger.LogInformation(
            "Sending image to OpenAI Vision: mimeType={MimeType}, bytes={Bytes}, hasText={HasText}",
            mimeType, imageBytes.Length, !string.IsNullOrWhiteSpace(freeText));

        string content;
        try
        {
            content = await _executor.ExecuteAsync(
                "food-parse-image",
                _settings.VisionModel ?? _settings.FoodModel,
                messages,
                ParsingSchemas.FoodFormat(opts));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OpenAI Vision API call failed");
            throw new InvalidOperationException("Failed to analyze the image. Try again or enter food manually.");
        }

        _logger.LogInformation("OpenAI Vision parse succeeded (response length {Length})", content.Length);

        // No cache on the image path: photos are effectively never identical.
        return ProcessResponse(content, opts);
    }

    private ChatImageDetailLevel ResolveVisionDetail()
        => _settings.VisionDetail.Trim().ToLowerInvariant() switch
        {
            "low" => ChatImageDetailLevel.Low,
            "high" => ChatImageDetailLevel.High,
            _ => ChatImageDetailLevel.Auto
        };
}
