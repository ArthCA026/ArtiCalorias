using System.Text.Json;
using Articalorias.Configuration;
using Articalorias.DTOs.ActivityParsing;
using Articalorias.Interfaces;
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
    private readonly ChatClient _chatClient;
    private readonly ILogger<ActivityParsingService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public ActivityParsingService(IOptions<OpenAiSettings> settings, ILogger<ActivityParsingService> logger)
    {
        _logger = logger;
        var config = settings.Value;

        if (string.IsNullOrWhiteSpace(config.ApiKey))
            throw new InvalidOperationException(
                "OpenAI API key is not configured. Set OpenAI:ApiKey in appsettings.json.");

        _chatClient = new ChatClient(config.Model, config.ApiKey);
    }

    public async Task<IReadOnlyList<ParsedActivityItem>> ParseFreeTextAsync(string freeText)
    {
        if (string.IsNullOrWhiteSpace(freeText))
            return [];

        var messages = new List<ChatMessage>
        {
            new SystemChatMessage(ActivityParseSystemPrompt),
            new UserChatMessage(freeText)
        };

        var options = new ChatCompletionOptions
        {
            Temperature = 0.2f,
            ResponseFormat = ChatResponseFormat.CreateJsonObjectFormat()
        };

        ChatCompletion completion;
        try
        {
            completion = await _chatClient.CompleteChatAsync(messages, options);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OpenAI API call failed for activity input: {Input}", freeText);
            throw new InvalidOperationException("Failed to parse activity description. Try again or enter manually.");
        }

        var content = completion.Content[0].Text;
        _logger.LogInformation("OpenAI activity parse response: {Response}", content);

        var items = DeserializeActivityResponse(content);
        return ValidateActivities(items);
    }

    public async Task<EstimateMetResponse> EstimateMetAsync(string activityName, decimal? durationMinutes)
    {
        if (string.IsNullOrWhiteSpace(activityName))
            throw new ArgumentException("Activity name is required.", nameof(activityName));

        var userMessage = durationMinutes.HasValue
            ? $"{activityName} ({durationMinutes.Value} minutes)"
            : activityName;

        var messages = new List<ChatMessage>
        {
            new SystemChatMessage(MetEstimateSystemPrompt),
            new UserChatMessage(userMessage)
        };

        var options = new ChatCompletionOptions
        {
            Temperature = 0.2f,
            ResponseFormat = ChatResponseFormat.CreateJsonObjectFormat()
        };

        ChatCompletion completion;
        try
        {
            completion = await _chatClient.CompleteChatAsync(messages, options);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OpenAI API call failed for MET estimate: {Activity}", activityName);
            throw new InvalidOperationException("Failed to estimate MET value. Try again or enter manually.");
        }

        var content = completion.Content[0].Text;
        _logger.LogInformation("OpenAI MET estimate response: {Response}", content);

        return DeserializeMetResponse(content, activityName);
    }

    // ─────────────────────────────────────────────────────
    //  Prompts
    // ─────────────────────────────────────────────────────

    private const string ActivityParseSystemPrompt = """
        You are a fitness and exercise assistant. The user will describe activities they performed in free text, in Spanish or English. Parse each distinct activity into structured data.

        Return JSON only.
        Return a JSON object with a single key "items" containing an array.

        Each item must have exactly these fields:
        - activityName (string): normalized activity name
        - activityType (string): always "MET_SIMPLE"
        - durationMinutes (number | null): total duration in minutes, or null if not specified
        - metValue (number | null): estimated MET value for the activity
        - notes (null): always null
        - segments (null): always null

        Rules:
        - Parse each distinct activity as a separate item.
        - If the user mentions multiple activities joined by "and", "y", commas, or similar separators, return one item per activity.
        - activityType must always be "MET_SIMPLE".
        - notes must always be null.
        - segments must always be null.
        - Estimate a reasonable MET value based on the Compendium of Physical Activities.
        - Round metValue to 1 decimal place.
        - Convert durations to minutes.
        - Support inputs in English or Spanish.
        - Never return negative values.
        - If duration is not stated clearly, use null instead of inventing a duration.
        - If the activity is too vague to assign a confident MET value, use the most reasonable common estimate for that activity label.
        - Output valid JSON only, with no markdown or extra text.

        Reference MET examples:
        - Walking (moderate): 3.5
        - Running (8 km/h): 8.3
        - Cycling (moderate): 6.8
        - Swimming (moderate): 5.8
        - Weight training: 5.0
        - Yoga: 2.5
        - HIIT: 10.0
        - Stretching: 2.3

        Example input: "30 min corriendo y 15 min de estiramiento"
        Example output:
        {
          "items": [
            {
              "activityName": "Running",
              "activityType": "MET_SIMPLE",
              "durationMinutes": 30,
              "metValue": 8.3,
              "notes": null,
              "segments": null
            },
            {
              "activityName": "Stretching",
              "activityType": "MET_SIMPLE",
              "durationMinutes": 15,
              "metValue": 2.3,
              "notes": null,
              "segments": null
            }
          ]
        }
        """;

    private const string MetEstimateSystemPrompt = """
            You are a fitness expert. The user will provide the name of a physical activity in English or Spanish. 
            Estimate the MET (Metabolic Equivalent of Task) value for that activity using the Compendium of Physical Activities as reference.

            Return JSON only.

            Return a JSON object with exactly these fields:
            - metValue (number): the estimated MET value, rounded to 1 decimal place
            - explanation (string): a single concise sentence explaining the choice

            Reference MET values (use these as anchors):
            - Sitting quietly: 1.0
            - Walking (slow, 3 km/h): 2.0
            - Walking (moderate, 5 km/h): 3.5
            - Cycling (moderate): 6.8
            - Running (8 km/h): 8.3
            - Running (10 km/h): 10.0
            - Swimming (moderate): 5.8
            - Weight training (moderate): 5.0
            - Yoga: 2.5
            - HIIT: 10.0
            - Stretching: 2.3
            - Dancing: 5.5
            - Basketball: 6.5
            - Soccer: 7.0

            Rules:
            - Use the most common/moderate intensity if intensity is not specified.
            - Ignore duration, calories, or distance unless they clearly imply intensity.
            - If the activity is vague (e.g., "workout", "exercise"), choose a reasonable general estimate (~5.0 MET).
            - Always return a deterministic value for the same input.
            - Round metValue to 1 decimal place.
            - Keep the explanation short, specific, and limited to one sentence.
            - Output valid JSON only, with no extra text.
            """;

    // ─────────────────────────────────────────────────────
    //  Deserialization
    // ─────────────────────────────────────────────────────

    private static List<ParsedActivityItem> DeserializeActivityResponse(string json)
    {
        try
        {
            var wrapper = JsonSerializer.Deserialize<ActivityResponseWrapper>(json, JsonOptions);
            return wrapper?.Items ?? [];
        }
        catch (JsonException)
        {
            throw new InvalidOperationException(
                "OpenAI returned an invalid response format. Try again or enter manually.");
        }
    }

    private static EstimateMetResponse DeserializeMetResponse(string json, string activityName)
    {
        try
        {
            var result = JsonSerializer.Deserialize<MetResponseWrapper>(json, JsonOptions);
            return new EstimateMetResponse
            {
                ActivityName = activityName,
                MetValue = Math.Clamp(result?.MetValue ?? 3.5m, 0.5m, 50m),
                Explanation = result?.Explanation
            };
        }
        catch (JsonException)
        {
            throw new InvalidOperationException(
                "OpenAI returned an invalid response format. Try again or enter manually.");
        }
    }

    // ─────────────────────────────────────────────────────
    //  Validation
    // ─────────────────────────────────────────────────────

    private static IReadOnlyList<ParsedActivityItem> ValidateActivities(List<ParsedActivityItem> items)
    {
        if (items.Count == 0)
            throw new InvalidOperationException("OpenAI returned no activity items. Try a more descriptive input.");

        var validated = new List<ParsedActivityItem>();

        foreach (var item in items)
        {
            if (string.IsNullOrWhiteSpace(item.ActivityName))
                continue;

            // Normalize activity type
            var validTypes = new[] { "MET_SIMPLE", "MET_MULTIPLE" };
            if (!validTypes.Contains(item.ActivityType))
                item.ActivityType = "MET_SIMPLE";

            // Clamp values
            if (item.DurationMinutes.HasValue)
                item.DurationMinutes = Math.Clamp(item.DurationMinutes.Value, 0, 1440);

            if (item.MetValue.HasValue)
                item.MetValue = Math.Clamp(item.MetValue.Value, 0.5m, 50m);

            // Validate segments for MET_MULTIPLE
            if (item.ActivityType == "MET_MULTIPLE" && item.Segments.Count > 0)
            {
                foreach (var seg in item.Segments)
                {
                    seg.MetValue = Math.Clamp(seg.MetValue, 0.5m, 50m);
                    seg.DurationMinutes = Math.Clamp(seg.DurationMinutes, 0.1m, 1440m);
                }
            }
            else if (item.ActivityType != "MET_MULTIPLE")
            {
                item.Segments = [];
            }

            validated.Add(item);
        }

        if (validated.Count == 0)
            throw new InvalidOperationException("All parsed items were invalid. Try again or enter manually.");

        return validated;
    }

    // ─────────────────────────────────────────────────────
    //  Internal DTOs for deserialization
    // ─────────────────────────────────────────────────────

    private sealed class ActivityResponseWrapper
    {
        public List<ParsedActivityItem> Items { get; set; } = [];
    }

    private sealed class MetResponseWrapper
    {
        public decimal MetValue { get; set; }
        public string? Explanation { get; set; }
    }
}
