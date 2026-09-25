using System.ClientModel;
using System.ClientModel.Primitives;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text.Json.Nodes;
using Articalorias.Configuration;
using Articalorias.Exceptions;
using Articalorias.Interfaces;
using Microsoft.Extensions.Options;
using OpenAI;
using OpenAI.Chat;

namespace Articalorias.Services;

/// <summary>
/// Singleton wrapper around the OpenAI SDK. One <see cref="ChatClient"/> per
/// (model, lane) — clients are thread-safe — with shared cost guards on every
/// call and structured token-usage logging: the raw numbers behind the bill.
///
/// Flex lane: when configured, calls first go out with service_tier "flex"
/// (Batch pricing, 50% off, synchronous). Flex may be slower or answer 429
/// "no capacity right now" (not billed); either way the executor re-sends on
/// the standard lane so callers never see a flex-specific failure.
/// </summary>
public class OpenAiChatExecutor : IOpenAiChatExecutor
{
    private readonly OpenAiSettings _settings;
    private readonly ILogger<OpenAiChatExecutor> _logger;
    private readonly ConcurrentDictionary<string, ChatClient> _standardClients = new();
    private readonly ConcurrentDictionary<string, ChatClient> _flexClients = new();

    /// <summary>
    /// Circuit breaker: set when the API rejects service_tier outright (400),
    /// e.g. a model without flex support. Prevents paying a doomed extra
    /// round-trip on every call for the rest of the process lifetime.
    /// </summary>
    private volatile bool _flexUnsupported;

    // Global daily call ceiling (all users). Single instance, in memory: a
    // restart resets the day, which only ever errs towards allowing calls.
    private readonly object _ceilingLock = new();
    private DateOnly _ceilingDayUtc;
    private int _callsToday;

    public OpenAiChatExecutor(IOptions<OpenAiSettings> settings, ILogger<OpenAiChatExecutor> logger)
    {
        _settings = settings.Value;
        _logger = logger;

        if (string.IsNullOrWhiteSpace(_settings.ApiKey))
            throw new InvalidOperationException(
                "OpenAI API key is not configured. Set OpenAI:ApiKey in appsettings.json.");
    }

    public async Task<string> ExecuteAsync(
        string feature,
        string? modelOverride,
        IList<ChatMessage> messages,
        ChatResponseFormat responseFormat)
    {
        EnforceSpendGuards(feature);

        var model = _settings.ResolveModel(modelOverride);
        var useFlex = !string.IsNullOrWhiteSpace(_settings.ServiceTier) && !_flexUnsupported;

        if (useFlex)
        {
            try
            {
                // Bounded wait: flex is allowed to be slower, not to hang the
                // user. Past the timeout the standard lane takes over.
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(_settings.FlexTimeoutSeconds));
                return await CallAsync(GetFlexClient(model), feature, model, _settings.ServiceTier, messages, responseFormat, cts.Token);
            }
            catch (ClientResultException ex) when (ex.Status == 400 && ex.Message.Contains("service_tier", StringComparison.OrdinalIgnoreCase))
            {
                _flexUnsupported = true;
                _logger.LogWarning(ex, "OpenAI rejected service_tier '{Tier}'; disabling flex until restart", _settings.ServiceTier);
            }
            catch (ClientResultException ex) when (ex.Status == 429)
            {
                // Flex capacity 429s are expected and not billed.
                _logger.LogInformation("Flex capacity unavailable for {Feature}; falling back to standard tier", feature);
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("Flex call for {Feature} exceeded {Timeout}s; falling back to standard tier",
                    feature, _settings.FlexTimeoutSeconds);
            }
        }

        return await CallAsync(GetStandardClient(model), feature, model, "standard", messages, responseFormat, CancellationToken.None);
    }

    private async Task<string> CallAsync(
        ChatClient client,
        string feature,
        string model,
        string tier,
        IList<ChatMessage> messages,
        ChatResponseFormat responseFormat,
        CancellationToken cancellationToken)
    {
        // Fresh options per attempt — never share mutable SDK state between
        // the flex try and the standard fallback.
        var options = new ChatCompletionOptions
        {
            ResponseFormat = responseFormat,
            MaxOutputTokenCount = _settings.MaxOutputTokens
        };

        // Reasoning tokens are billed as output; "none" suppresses them for
        // extraction work. Left unset when configured empty so non-reasoning
        // models don't reject the request.
        // OPENAI001: the property is marked experimental in the SDK, but it is
        // the only way to control reasoning spend — accept the API-change risk.
#pragma warning disable OPENAI001
        if (!string.IsNullOrWhiteSpace(_settings.ReasoningEffort))
            options.ReasoningEffortLevel = new ChatReasoningEffortLevel(_settings.ReasoningEffort);
#pragma warning restore OPENAI001

        var stopwatch = Stopwatch.StartNew();
        ChatCompletion completion = await client.CompleteChatAsync(messages, options, cancellationToken);
        stopwatch.Stop();

        var usage = completion.Usage;
        _logger.LogInformation(
            "OpenAI usage feature={Feature} model={Model} tier={Tier} inputTokens={InputTokens} cachedInputTokens={CachedInputTokens} outputTokens={OutputTokens} reasoningTokens={ReasoningTokens} durationMs={DurationMs}",
            feature,
            model,
            tier,
            usage?.InputTokenCount ?? -1,
            usage?.InputTokenDetails?.CachedTokenCount ?? 0,
            usage?.OutputTokenCount ?? -1,
            usage?.OutputTokenDetails?.ReasoningTokenCount ?? 0,
            stopwatch.ElapsedMilliseconds);

        return completion.Content.Count > 0 ? completion.Content[0].Text ?? string.Empty : string.Empty;
    }

    /// <summary>
    /// Kill switch and the day-wide call ceiling. Thrown as ApiException so the
    /// parsing services' catch-alls let it through as a 503 the app understands.
    /// </summary>
    private void EnforceSpendGuards(string feature)
    {
        if (!_settings.Enabled)
        {
            _logger.LogWarning("OpenAI call for {Feature} refused: OpenAI:Enabled is false", feature);
            throw new ApiException(ErrorCodes.AiUnavailable,
                "AI parsing is temporarily unavailable. Please enter the item manually.",
                StatusCodes.Status503ServiceUnavailable);
        }

        if (_settings.DailyCallCeiling <= 0)
            return;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        int callsToday;
        lock (_ceilingLock)
        {
            if (_ceilingDayUtc != today)
            {
                _ceilingDayUtc = today;
                _callsToday = 0;
            }
            callsToday = ++_callsToday;
        }

        if (callsToday > _settings.DailyCallCeiling)
        {
            _logger.LogWarning("OpenAI daily call ceiling ({Ceiling}) reached; refusing {Feature}",
                _settings.DailyCallCeiling, feature);
            throw new ApiException(ErrorCodes.AiUnavailable,
                "AI parsing is temporarily unavailable. Please enter the item manually.",
                StatusCodes.Status503ServiceUnavailable);
        }
    }

    private ChatClient GetStandardClient(string model)
        => _standardClients.GetOrAdd(model, m => new ChatClient(m, _settings.ApiKey));

    private ChatClient GetFlexClient(string model)
        => _flexClients.GetOrAdd(model, m =>
        {
            // The installed SDK has no typed service_tier setting, so a
            // pipeline policy injects it into the request JSON. Retries are
            // disabled on this client: a flex 429 should fail fast into the
            // standard-lane fallback, not burn seconds on doomed retries.
            var clientOptions = new OpenAIClientOptions
            {
                RetryPolicy = new ClientRetryPolicy(maxRetries: 0)
            };
            clientOptions.AddPolicy(new ServiceTierPolicy(_settings.ServiceTier), PipelinePosition.PerCall);
            return new ChatClient(m, new ApiKeyCredential(_settings.ApiKey), clientOptions);
        });

    /// <summary>Rewrites the outgoing request body to add "service_tier".</summary>
    private sealed class ServiceTierPolicy : PipelinePolicy
    {
        private readonly string _tier;

        public ServiceTierPolicy(string tier) => _tier = tier;

        public override void Process(PipelineMessage message, IReadOnlyList<PipelinePolicy> pipeline, int currentIndex)
        {
            InjectTier(message);
            ProcessNext(message, pipeline, currentIndex);
        }

        public override async ValueTask ProcessAsync(PipelineMessage message, IReadOnlyList<PipelinePolicy> pipeline, int currentIndex)
        {
            InjectTier(message);
            await ProcessNextAsync(message, pipeline, currentIndex).ConfigureAwait(false);
        }

        private void InjectTier(PipelineMessage message)
        {
            if (message.Request?.Content is null)
                return;

            using var buffer = new MemoryStream();
            message.Request.Content.WriteTo(buffer);
            buffer.Position = 0;

            JsonNode? body;
            try
            {
                body = JsonNode.Parse(buffer);
            }
            catch (System.Text.Json.JsonException)
            {
                return; // not a JSON body — leave untouched
            }

            if (body is not JsonObject json)
                return;

            json["service_tier"] = _tier;
            message.Request.Content = BinaryContent.Create(BinaryData.FromString(json.ToJsonString()));
        }
    }
}
