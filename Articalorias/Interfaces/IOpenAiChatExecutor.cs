using OpenAI.Chat;

namespace Articalorias.Interfaces;

/// <summary>
/// Single funnel for every OpenAI chat call the app makes. Centralizes the
/// cost controls (model routing, reasoning effort, output-token ceiling) and
/// records per-call token usage so spend is visible per feature instead of
/// being discarded.
/// </summary>
public interface IOpenAiChatExecutor
{
    /// <summary>
    /// Executes a chat completion and returns the raw response text.
    /// Exceptions propagate so each caller keeps its own user-facing wording.
    /// </summary>
    /// <param name="feature">Short tag for usage logs (e.g. "food-parse").</param>
    /// <param name="modelOverride">Per-task model; null/empty uses the default.</param>
    /// <param name="messages">Full message list including the system prompt.</param>
    /// <param name="responseFormat">Strict JSON-schema response format.</param>
    Task<string> ExecuteAsync(
        string feature,
        string? modelOverride,
        IList<ChatMessage> messages,
        ChatResponseFormat responseFormat);
}
