namespace Articalorias.Evals;

// Case-file DTOs. Expected values assert the SERVICE's output (post-scaling
// totals, exactly what the app shows the user), not raw model output.

public class FoodCase
{
    public string Id { get; set; } = string.Empty;
    public string Input { get; set; } = string.Empty;
    public string? Country { get; set; }
    public int MinItems { get; set; } = 1;
    public int MaxItems { get; set; } = 99;

    /// <summary>Sum of kcal across all items — for composite dishes where the
    /// item split is legitimately variable (e.g. "casado con pollo").</summary>
    public decimal? TotalKcal { get; set; }
    public decimal TotalKcalTolerancePct { get; set; } = 40;

    /// <summary>Optional macros to request for this case (catalog keys: "sugar", "water", "caffeine", ...).</summary>
    public List<string> OptionalMacros { get; set; } = [];

    public List<FoodExpectation> Expect { get; set; } = [];
}

public class FoodExpectation
{
    /// <summary>Item matches when its name contains ANY of these
    /// (case- and accent-insensitive).</summary>
    public List<string> NameContains { get; set; } = [];

    /// <summary>Expected total kcal for the matched item, ± tolerance %.</summary>
    public decimal? Kcal { get; set; }
    public decimal KcalTolerancePct { get; set; } = 25;

    /// <summary>Absolute kcal bounds — for near-zero foods where a percentage
    /// tolerance is meaningless ("cafe negro", "diet coke").</summary>
    public decimal? KcalMin { get; set; }
    public decimal? KcalMax { get; set; }

    public decimal? Prot { get; set; }
    public decimal? Fat { get; set; }
    public decimal? Carb { get; set; }
    public decimal MacroToleranceGrams { get; set; } = 5;

    /// <summary>Alcoholic items must report at least this many alcohol grams.</summary>
    public decimal? AlcoholMin { get; set; }

    /// <summary>Expected amounts by catalog key (any macro), ± MacroToleranceGrams.</summary>
    public Dictionary<string, decimal> Macros { get; set; } = new();
}

public class ActivityCase
{
    public string Id { get; set; } = string.Empty;
    public string Input { get; set; } = string.Empty;
    public int MinItems { get; set; } = 1;
    public int MaxItems { get; set; } = 99;
    public List<ActivityExpectation> Expect { get; set; } = [];
}

public class ActivityExpectation
{
    public List<string> NameContains { get; set; } = [];

    /// <summary>Expect the unnamed smart-watch item (name == "").</summary>
    public bool? NameEmpty { get; set; }

    /// <summary>User-stated durations must round-trip exactly.</summary>
    public decimal? DurationMinutes { get; set; }
    public bool? DurationNull { get; set; }

    public decimal? MetMin { get; set; }
    public decimal? MetMax { get; set; }
    public bool? MetNull { get; set; }

    /// <summary>User-stated calories must round-trip exactly.</summary>
    public decimal? Kcal { get; set; }
    public bool? KcalNull { get; set; }
}

public class MetCase
{
    public string Id { get; set; } = string.Empty;
    public string Input { get; set; } = string.Empty;
    public decimal MetMin { get; set; }
    public decimal MetMax { get; set; }
}

public class CaseResult
{
    public string Id { get; set; } = string.Empty;
    public string Input { get; set; } = string.Empty;
    public bool Passed { get; set; }
    public List<string> Failures { get; set; } = [];
    public long DurationMs { get; set; }
    public string? RawResult { get; set; }
}

public class SuiteResult
{
    public string Suite { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public DateTime RanAtUtc { get; set; }
    public int Total { get; set; }
    public int Passed { get; set; }
    public double PassRate => Total == 0 ? 0 : (double)Passed / Total;
    public List<CaseResult> Cases { get; set; } = [];
}
