using System.Collections.Concurrent;
using System.Diagnostics;
using Articalorias.Configuration;
using Articalorias.Interfaces;
using Microsoft.Extensions.Options;
using OpenAI.Chat;

namespace Articalorias.Services;

/// <summary>
/// Singleton wrapper around the OpenAI SDK. One <see cref="ChatClient"/> per
/// model (clients are thread-safe), shared cost guards on every call, and
/// structured token-usage logging — the raw numbers behind the OpenAI bill.
/// </summary>
public class OpenAiChatExecutor : IOpenAiChatExecutor
{
    private readonly OpenAiSettings _settings;
    private readonly ILogger<OpenAiChatExecutor> _logger;
    private readonly ConcurrentDictionary<string, ChatClient> _clients = new();

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
        var model = _settings.ResolveModel(modelOverride);
        var client = _clients.GetOrAdd(model, m => new ChatClient(m, _settings.ApiKey));

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
        ChatCompletion completion = await client.CompleteChatAsync(messages, options);
        stopwatch.Stop();

        var usage = completion.Usage;
        _logger.LogInformation(
            "OpenAI usage feature={Feature} model={Model} inputTokens={InputTokens} cachedInputTokens={CachedInputTokens} outputTokens={OutputTokens} reasoningTokens={ReasoningTokens} durationMs={DurationMs}",
            feature,
            model,
            usage?.InputTokenCount ?? -1,
            usage?.InputTokenDetails?.CachedTokenCount ?? 0,
            usage?.OutputTokenCount ?? -1,
            usage?.OutputTokenDetails?.ReasoningTokenCount ?? 0,
            stopwatch.ElapsedMilliseconds);

        return completion.Content.Count > 0 ? completion.Content[0].Text ?? string.Empty : string.Empty;
    }
}
