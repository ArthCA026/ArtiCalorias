namespace Articalorias.Configuration;

public class OpenAiSettings
{
    public const string SectionName = "OpenAI";

    public string ApiKey { get; set; } = string.Empty;

    /// <summary>
    /// Default model for every AI task without an explicit override below.
    /// gpt-5.6-luna is OpenAI's cost-sensitive high-volume tier — the parsing
    /// tasks here are simple JSON extraction and do not need a flagship model.
    /// </summary>
    public string Model { get; set; } = "gpt-5.6-luna";

    /// <summary>Optional per-task overrides. Null/empty falls back to <see cref="Model"/>.</summary>
    public string? FoodModel { get; set; }
    public string? VisionModel { get; set; }
    public string? ActivityModel { get; set; }
    public string? MetModel { get; set; }

    /// <summary>
    /// Reasoning effort for reasoning-capable models. Hidden reasoning tokens
    /// are billed as output tokens, so anything above the floor multiplies cost
    /// for zero extraction benefit. GPT-5.6+ accepts none|low|medium|high|xhigh
    /// (the gpt-5-era "minimal" is rejected). Empty string omits the parameter
    /// entirely (required for models that reject it).
    /// </summary>
    public string ReasoningEffort { get; set; } = "none";

    /// <summary>
    /// Hard ceiling on completion tokens per call so a runaway generation can
    /// never produce an unbounded bill. Normal parses use well under half this.
    /// </summary>
    public int MaxOutputTokens { get; set; } = 800;

    /// <summary>
    /// Vision input fidelity: "auto" | "low" | "high". "low" caps the image at
    /// 512x512 (~4x fewer image tokens than a 1024px auto image) and is enough
    /// for plate-level food recognition; flip back to "auto" if real photos
    /// show missed small items.
    /// </summary>
    public string VisionDetail { get; set; } = "low";

    /// <summary>
    /// OpenAI processing lane. "flex" bills at Batch rates (50% off) on
    /// synchronous calls in exchange for slower responses and occasional
    /// capacity 429s — the executor falls back to the standard lane
    /// automatically, so users only ever see the latency cost.
    /// Empty string disables and always uses the standard lane.
    /// </summary>
    public string ServiceTier { get; set; } = "flex";

    /// <summary>
    /// How long a flex attempt may run before the executor gives up and
    /// re-sends on the standard lane. Bounds worst-case user-facing latency.
    /// </summary>
    public int FlexTimeoutSeconds { get; set; } = 20;

    /// <summary>
    /// Days a cached text-parse response stays valid. MET estimates never expire
    /// (the prompt itself demands deterministic answers per activity name).
    /// </summary>
    public int ParseCacheTtlDays { get; set; } = 30;

    public string ResolveModel(string? overrideModel)
        => string.IsNullOrWhiteSpace(overrideModel) ? Model : overrideModel;
}
