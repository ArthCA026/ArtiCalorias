using System.Diagnostics;
using System.Text.Json;
using Articalorias.Configuration;
using Articalorias.DTOs.FoodParsing;
using Articalorias.Evals;
using Articalorias.Interfaces;
using Articalorias.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

// ============================================================
// ArtiCalorias parsing quality suite ("golden set").
//
//   dotnet run --project Articalorias.Evals -- --model gpt-5.6-luna
//   dotnet run --project Articalorias.Evals -- --model gpt-5.4-nano --suite food
//
// Runs the PRODUCTION parsing services (same prompts, schemas, sanitizers)
// against bilingual cases with known-good answers and scores them in code.
// Use it to compare models before scaling down: run once per candidate model
// and diff the pass rates. Costs real OpenAI tokens (~60 small calls per full
// run); caching is disabled so every case measures the live model.
//
// API key: OpenAI:ApiKey from the main app's user-secrets, or OPENAI_API_KEY.
// Results: console summary + JSON file under results/.
// ============================================================

var model = GetArg(args, "--model") ?? "gpt-5.6-luna";
var suite = (GetArg(args, "--suite") ?? "all").ToLowerInvariant();
var casesDir = GetArg(args, "--cases") ?? Path.Combine(AppContext.BaseDirectory, "cases");
var outDir = GetArg(args, "--out") ?? Path.Combine(Directory.GetCurrentDirectory(), "results");

var config = new ConfigurationBuilder()
    .AddUserSecrets("d6f1a0b3-4e2c-4f8d-9a1b-7c3e5d8f0a2b") // main app's secrets id
    .AddEnvironmentVariables()
    .Build();

var apiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY") ?? config["OpenAI:ApiKey"];
if (string.IsNullOrWhiteSpace(apiKey))
{
    Console.Error.WriteLine("No API key. Set OPENAI_API_KEY or OpenAI:ApiKey in the main app's user-secrets.");
    return 2;
}

// Same guards as production, but: target model for every task, standard lane
// only (flex 429 noise must not pollute a quality run), and no cache — every
// case must measure the live model.
var settings = new OpenAiSettings
{
    ApiKey = apiKey,
    Model = model,
    ReasoningEffort = "none",
    MaxOutputTokens = 800,
    ServiceTier = string.Empty,
};

var executor = new OpenAiChatExecutor(Options.Create(settings), NullLogger<OpenAiChatExecutor>.Instance);
var noCache = new NoOpAiResponseCache();
var foodService = new FoodParsingService(executor, noCache, Options.Create(settings), NullLogger<FoodParsingService>.Instance);
var activityService = new ActivityParsingService(executor, noCache, Options.Create(settings), NullLogger<ActivityParsingService>.Instance);

var jsonOptions = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
var writeOptions = new JsonSerializerOptions { WriteIndented = true };
var throttle = new SemaphoreSlim(4); // be gentle with rate limits
var suites = new List<SuiteResult>();

Console.WriteLine($"Model: {model}   Suite: {suite}");
Console.WriteLine(new string('─', 60));

if (suite is "food" or "all")
    suites.Add(await RunSuite("food", Load<FoodCase>("food.json"), async c =>
    {
        var options = c.OptionalMacros.Count > 0 ? new FoodParsingOptions(c.OptionalMacros) : null;
        var items = await foodService.ParseFreeTextAsync(c.Input, c.Country, options);
        return EvalScoring.ScoreFood(c, items);
    }));

if (suite is "activity" or "all")
    suites.Add(await RunSuite("activity", Load<ActivityCase>("activity.json"), async c =>
    {
        var items = await activityService.ParseFreeTextAsync(c.Input);
        return EvalScoring.ScoreActivity(c, items);
    }));

if (suite is "met" or "all")
    suites.Add(await RunSuite("met", Load<MetCase>("met.json"), async c =>
    {
        var response = await activityService.EstimateMetAsync(c.Input, null);
        return EvalScoring.ScoreMet(c, response);
    }));

if (suites.Count == 0)
{
    Console.Error.WriteLine($"Unknown suite '{suite}'. Use food | activity | met | all.");
    return 2;
}

// Summary + results file
Console.WriteLine(new string('═', 60));
Directory.CreateDirectory(outDir);
var stamp = DateTime.UtcNow.ToString("yyyyMMdd-HHmmss");
var safeModel = string.Join("-", model.Split(Path.GetInvalidFileNameChars()));

foreach (var s in suites)
{
    Console.WriteLine($"{s.Suite,-10} {s.Passed}/{s.Total} passed ({s.PassRate:P0})");
    var file = Path.Combine(outDir, $"{safeModel}_{s.Suite}_{stamp}.json");
    File.WriteAllText(file, JsonSerializer.Serialize(s, writeOptions));
    Console.WriteLine($"           → {file}");
}

var overallTotal = suites.Sum(s => s.Total);
var overallPassed = suites.Sum(s => s.Passed);
Console.WriteLine($"{"OVERALL",-10} {overallPassed}/{overallTotal} ({(double)overallPassed / overallTotal:P0})");
return 0;

// ── helpers ──

async Task<SuiteResult> RunSuite<TCase>(string name, List<TCase> cases, Func<TCase, Task<CaseResult>> run) where TCase : class
{
    Console.WriteLine($"\n{name} suite: {cases.Count} cases");

    var tasks = cases.Select(async c =>
    {
        await throttle.WaitAsync();
        try
        {
            var sw = Stopwatch.StartNew();
            CaseResult result;
            try
            {
                result = await run(c);
            }
            catch (Exception ex)
            {
                // A thrown parse is a failed case, not a crashed run.
                var (id, input) = CaseIdentity(c);
                result = new CaseResult { Id = id, Input = input, Passed = false, Failures = [$"exception: {ex.Message}"] };
            }
            result.DurationMs = sw.ElapsedMilliseconds;
            Console.WriteLine(result.Passed
                ? $"  ✓ {result.Id}"
                : $"  ✗ {result.Id}: {string.Join(" | ", result.Failures)}");
            return result;
        }
        finally
        {
            throttle.Release();
        }
    });

    var results = (await Task.WhenAll(tasks)).ToList();
    return new SuiteResult
    {
        Suite = name,
        Model = model,
        RanAtUtc = DateTime.UtcNow,
        Total = results.Count,
        Passed = results.Count(r => r.Passed),
        Cases = results
    };
}

List<T> Load<T>(string fileName)
{
    var path = Path.Combine(casesDir, fileName);
    if (!File.Exists(path))
    {
        Console.Error.WriteLine($"Case file not found: {path}");
        return [];
    }
    return JsonSerializer.Deserialize<List<T>>(File.ReadAllText(path), jsonOptions) ?? [];
}

static (string Id, string Input) CaseIdentity(object c) => c switch
{
    FoodCase f => (f.Id, f.Input),
    ActivityCase a => (a.Id, a.Input),
    MetCase m => (m.Id, m.Input),
    _ => ("?", "?")
};

static string? GetArg(string[] args, string name)
{
    var index = Array.IndexOf(args, name);
    return index >= 0 && index + 1 < args.Length ? args[index + 1] : null;
}
