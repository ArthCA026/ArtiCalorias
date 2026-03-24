using System.Text.Json;
using Articalorias.Configuration;
using Articalorias.DTOs.FoodParsing;
using Articalorias.Interfaces;
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
    private readonly ChatClient _chatClient;
    private readonly ILogger<FoodParsingService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public FoodParsingService(IOptions<OpenAiSettings> settings, ILogger<FoodParsingService> logger)
    {
        _logger = logger;
        var config = settings.Value;

        if (string.IsNullOrWhiteSpace(config.ApiKey))
            throw new InvalidOperationException(
                "OpenAI API key is not configured. Set OpenAI:ApiKey in appsettings.json.");

        _chatClient = new ChatClient(config.Model, config.ApiKey);
    }

    public async Task<IReadOnlyList<ParsedFoodItem>> ParseFreeTextAsync(string freeText, string? country = null)
    {
        if (string.IsNullOrWhiteSpace(freeText))
            return [];

        var systemPrompt = string.IsNullOrWhiteSpace(country)
            ? DeveloperPrompt
            : $"{DeveloperPrompt}\n\nThe user is located in {country}. Use typical food products, brands, and portion sizes common in {country} when estimating calories and macros.";

        // 1. Build the prompt
        var messages = new List<ChatMessage>
        {
            new SystemChatMessage(systemPrompt),
            new UserChatMessage(freeText)
        };

        var options = new ChatCompletionOptions
        {
            Temperature = 0.2f,
            ResponseFormat = ChatResponseFormat.CreateJsonObjectFormat()
        };

        // 2. Call OpenAI
        ChatCompletion completion;
        try
        {
            completion = await _chatClient.CompleteChatAsync(messages, options);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OpenAI API call failed for input: {Input}", freeText);
            throw new InvalidOperationException("Failed to parse food description. Try again or enter manually.");
        }

        var content = completion.Content[0].Text;
        _logger.LogInformation("OpenAI response: {Response}", content);

        // 3. Deserialize
        var items = DeserializeResponse(content);

        // 4. Validate — bad AI output never reaches the frontend
        return Validate(items);
    }

    // ─────────────────────────────────────────────────────
    //  Prompt — defines the contract between us and OpenAI
    // ─────────────────────────────────────────────────────

    private const string DeveloperPrompt = """
            You are a food-intake extraction engine.

            The user may describe foods or drinks in Spanish or English. Extract edible or drinkable items and convert them into structured nutrition estimates.

            Your goal is to produce realistic, consistent, and conservative nutritional approximations based on common foods, brands, and preparation methods.

            OUTPUT RULES
            - Return a JSON object with a single key: "items".
            - "items" must be an array.
            - If no valid food or drink is found, return: { "items": [] }.
            - Do not include any text outside the JSON object.

            EXTRACTION RULES
            - Split distinct foods into separate items.
            - Aggregate repeated identical items into one entry (e.g., "3 coffees" → one item with quantity 3).
            - If foods differ meaningfully (e.g., chicken taco vs beef taco), keep them separate.
            - Preserve important modifiers that affect nutrition:
              (e.g., con leche, con azúcar, frito, integral, descremado, light, con alcohol).

            - If a dish clearly contains multiple core components and splitting improves accuracy, you may separate them:
              Example: "arroz con pollo" → arroz + pollo (optional, only if useful).
            - Otherwise, keep it as a single item.

            - Do not invent side dishes, toppings, or ingredients not implied by the text.
            - However, you may infer minimal standard preparation when strongly implied:
              Example: fried foods include oil.

            PORTION RULES
            - If quantity is specified, use it.
            - If not, assume quantity = 1.
            - If portion is unclear, estimate a typical serving.
            - Use normalized units such as:
              g, ml, unidad, porcion, taza, pieza, cucharada, cucharadita, vaso, lata, botella, rebanada.

            NUTRITION RULES
            Priority order:
            1. User-provided calories/macros
            2. Known product, brand, or restaurant equivalent
            3. Generic food database estimates

            - Use realistic, conservative estimates.
            - Never return negative values.
            - Round calories and macro values to 1 decimal place.
            - quantity may be integer or decimal.

            - Ensure internal consistency using Atwater factors:
              protein = 4 kcal/g
              carbs = 4 kcal/g
              fat = 9 kcal/g
              alcohol = 7 kcal/g

            - Avoid fake precision:
              If uncertainty is high, use reasonable rounded estimates.

            SPECIAL CASES
            - If the item is a supplement, medicine, or non-caloric product:
              return zero or negligible calories and macros.

            - Alcohol:
              - For non-alcoholic items → alcoholGrams = 0
              - For alcoholic drinks → estimate alcoholGrams using typical serving and ABV unless specified
              - Alcohol calories must be included in caloriesKcal

            LANGUAGE RULES
            - Preserve foodName and portionDescription in the same language as the user input when possible.

            OUTPUT SCHEMA (STRICT)
            Each item must contain exactly these fields:

            - foodName (string)
            - portionDescription (string)
            - quantity (number)
            - unit (string)
            - caloriesKcal (number)
            - proteinGrams (number)
            - fatGrams (number)
            - carbsGrams (number)
            - alcoholGrams (number)

            - Do not include additional fields.
            - Do not omit any fields.
            """;

    // ─────────────────────────────────────────────────────
    //  Deserialization
    // ─────────────────────────────────────────────────────

    private static List<ParsedFoodItem> DeserializeResponse(string json)
    {
        try
        {
            var wrapper = JsonSerializer.Deserialize<OpenAiResponseWrapper>(json, JsonOptions);
            return wrapper?.Items ?? [];
        }
        catch (JsonException)
        {
            throw new InvalidOperationException(
                "OpenAI returned an invalid response format. Try again or enter manually.");
        }
    }

    // ─────────────────────────────────────────────────────
    //  Validation — reject bad AI output before it reaches the frontend
    // ─────────────────────────────────────────────────────

    private static IReadOnlyList<ParsedFoodItem> Validate(List<ParsedFoodItem> items)
    {
        if (items.Count == 0)
            throw new InvalidOperationException("OpenAI returned no food items. Try a more descriptive input.");

        var validated = new List<ParsedFoodItem>();

        foreach (var item in items)
        {
            if (string.IsNullOrWhiteSpace(item.FoodName))
                continue;

            // Clamp negatives to zero
            item.CaloriesKcal = Math.Max(0, item.CaloriesKcal);
            item.ProteinGrams = Math.Max(0, item.ProteinGrams);
            item.FatGrams = Math.Max(0, item.FatGrams);
            item.CarbsGrams = Math.Max(0, item.CarbsGrams);
            item.AlcoholGrams = Math.Max(0, item.AlcoholGrams);

            // Reject absurd single-item values
            if (item.CaloriesKcal > 10000)
                item.CaloriesKcal = 0;

            validated.Add(item);
        }

        if (validated.Count == 0)
            throw new InvalidOperationException("All parsed items were invalid. Try again or enter manually.");

        return validated;
    }

    // ─────────────────────────────────────────────────────
    //  Internal DTO for deserializing the { "items": [...] } wrapper
    // ─────────────────────────────────────────────────────

    private sealed class OpenAiResponseWrapper
    {
        public List<ParsedFoodItem> Items { get; set; } = [];
    }
}
