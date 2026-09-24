namespace Articalorias.Services.Macros;

/// <summary>
/// THE macro registry. Adding a nutrient to the app is one record here (plus,
/// optionally, an icon and a color token in the UI): storage (JSON maps), EF
/// mapping, request validation, preference defaults, per-day target snapshots,
/// TEF, the AI schema/prompt/sanitizer/cache key, barcode mapping and the
/// catalog endpoint all derive from these definitions.
///
/// Rules: keys are permanent (retire with IsActive = false, never delete);
/// a parent must sort before its children; wire keys are unique.
/// Bump <see cref="CatalogVersion"/> whenever a definition changes, and
/// <see cref="MacroTef.ModelVersion"/> as well when a TEF rate or an energy
/// density changes (that re-prices stored days).
/// </summary>
public static class MacroCatalog
{
    public const string CatalogVersion = "2026-09-18.1";

    /// <summary>
    /// How many macros one user may track at the same time, protein included.
    /// Every tracked optional macro adds a field and a rule to each paid AI
    /// parse, and every tracked macro adds a column under each meal row and a
    /// bar on the day, so the ceiling bounds both the cost and the layout no
    /// matter how large the catalog grows. Enforced by MacroPreferenceService
    /// when a macro is switched ON; accounts already above it keep what they
    /// track and simply cannot add more until they are back under it.
    /// </summary>
    public const int MaxTrackedMacros = 6;

    public const string Protein = "protein";
    public const string Fat = "fat";
    public const string Carbs = "carbs";
    public const string Alcohol = "alcohol";
    public const string Fiber = "fiber";
    public const string Sugar = "sugar";
    public const string Water = "water";
    public const string Caffeine = "caffeine";
    public const string Sodium = "sodium";

    public static IReadOnlyList<MacroDefinition> All { get; }
    public static IReadOnlyList<MacroDefinition> Active { get; }
    public static IReadOnlyList<MacroDefinition> Core { get; }
    public static IReadOnlyList<MacroDefinition> Optional { get; }
    public static IReadOnlyDictionary<string, MacroDefinition> ByKey { get; }
    public static IReadOnlyDictionary<string, MacroDefinition> ByWireKey { get; }

    private static readonly Dictionary<string, int> Index;

    static MacroCatalog()
    {
        All = Build();
        Validate(All);

        Active = All.Where(d => d.IsActive).ToList();
        Core = Active.Where(d => d.IsCore).ToList();
        Optional = Active.Where(d => !d.IsCore).ToList();
        ByKey = All.ToDictionary(d => d.Key, StringComparer.Ordinal);
        ByWireKey = Active.ToDictionary(d => d.AiWireKey, StringComparer.OrdinalIgnoreCase);
        Index = All.Select((d, i) => (d.Key, i)).ToDictionary(x => x.Key, x => x.i, StringComparer.Ordinal);
    }

    public static bool TryGet(string key, out MacroDefinition def)
        => ByKey.TryGetValue(key, out def!);

    /// <summary>Known at all, retired included: what stored data may contain.</summary>
    public static bool IsKnown(string key) => ByKey.ContainsKey(key);

    /// <summary>Accepted on new input: active only.</summary>
    public static bool IsAcceptedInput(string key)
        => ByKey.TryGetValue(key, out var def) && def.IsActive;

    /// <summary>Catalog position for ordering; unknown keys sort last.</summary>
    public static int IndexOf(string key)
        => Index.TryGetValue(key, out var i) ? i : int.MaxValue;

    private static IReadOnlyList<MacroDefinition> Build() =>
    [
        new MacroDefinition
        {
            Key = Protein,
            SortOrder = 10,
            Unit = MacroUnit.Grams,
            Direction = MacroDirection.Hit,
            IsCore = true,
            DefaultTracked = true,
            KcalPerGram = 4m,
            TefRate = 0.25m,
            AiWireKey = "prot",
            AiSchemaDescription = "Protein grams for ONE unit",
            PreScaleMax = 1000m,
            MaxPerEntry = 10000m,
            OffSources = [new OffSource("proteins", 1m)],
            Formula = new TargetFormula.PerKgBodyWeight(DefaultParam: 2.0m, ApplyAgeFloor: true),
            AutoParamRange = (0.5m, 4m),
            AutoPresets =
            [
                new AutoPreset("light", 1.0m,
                    new MacroLabels("Light", "Ligero"),
                    new MacroLabels("A simple target if protein is not your main focus.",
                                    "Una meta sencilla si la proteína no es tu prioridad.")),
                new AutoPreset("everyday", 1.2m,
                    new MacroLabels("Everyday", "Diario"),
                    new MacroLabels("A balanced target for general daily eating.",
                                    "Una meta equilibrada para la alimentación de cada día.")),
                new AutoPreset("weight-loss-support", 1.6m,
                    new MacroLabels("Weight Loss Support", "Apoyo a la pérdida"),
                    new MacroLabels("A higher target to support fullness and muscle retention during weight loss.",
                                    "Una meta más alta para saciarte y conservar músculo mientras pierdes peso.")),
                new AutoPreset("active-training", 1.8m,
                    new MacroLabels("Active Training", "Entrenamiento activo"),
                    new MacroLabels("A strong target for people who train regularly.",
                                    "Una meta fuerte para quienes entrenan con regularidad.")),
                new AutoPreset("muscle-gain", 2.0m,
                    new MacroLabels("Muscle Gain", "Ganancia muscular"),
                    new MacroLabels("A high-protein target for lifting, recovery, and muscle gain goals.",
                                    "Una meta alta en proteína para levantar pesas, recuperarte y ganar músculo.")),
            ],
            CustomTargetMin = 20m,
            CustomTargetMax = 500m,
            ShowInHeroBars = true,
            AlwaysInDayTotals = true,
            IconName = "drumstick",
            Name = new MacroLabels("Protein", "Proteína"),
            ShortName = new MacroLabels("Prot", "Prot"),
        },
        new MacroDefinition
        {
            Key = Fat,
            SortOrder = 20,
            Unit = MacroUnit.Grams,
            Direction = MacroDirection.Hit,
            IsCore = true,
            KcalPerGram = 9m,
            TefRate = 0.02m,
            AiWireKey = "fat",
            AiSchemaDescription = "Fat grams for ONE unit",
            PreScaleMax = 1000m,
            MaxPerEntry = 10000m,
            OffSources = [new OffSource("fat", 1m)],
            Formula = new TargetFormula.PercentOfBudget(0.30m),
            CustomTargetMin = 1m,
            CustomTargetMax = 1000m,
            ShowInHeroBars = true,
            AlwaysInDayTotals = true,
            IconName = "droplet",
            Name = new MacroLabels("Fat", "Grasa"),
            ShortName = new MacroLabels("Fat", "Grasa"),
        },
        new MacroDefinition
        {
            Key = Carbs,
            SortOrder = 30,
            Unit = MacroUnit.Grams,
            Direction = MacroDirection.Hit,
            IsCore = true,
            KcalPerGram = 4m,
            TefRate = 0.08m,
            AiWireKey = "carb",
            AiSchemaDescription = "Carb grams for ONE unit",
            PreScaleMax = 1000m,
            MaxPerEntry = 10000m,
            OffSources = [new OffSource("carbohydrates", 1m)],
            Formula = new TargetFormula.CarbsRemainder(),
            CustomTargetMin = 1m,
            CustomTargetMax = 2000m,
            ShowInHeroBars = true,
            AlwaysInDayTotals = true,
            IconName = "wheat",
            Name = new MacroLabels("Carbs", "Carbohidratos"),
            ShortName = new MacroLabels("Carbs", "Carbs"),
        },
        new MacroDefinition
        {
            Key = Alcohol,
            SortOrder = 40,
            Unit = MacroUnit.Grams,
            Direction = MacroDirection.Limit,
            IsCore = true,
            KcalPerGram = 7m,
            TefRate = 0.15m,
            AiWireKey = "alc",
            AiSchemaDescription = "Alcohol grams for ONE unit",
            PreScaleMax = 500m,
            MaxPerEntry = 10000m,
            // OFF stores alcohol as % vol, and repeats that same percentage in
            // the per-serving field instead of scaling it (verified against
            // live products 2026-09-18: a 500 ml beer lists alcohol_100g 5 and
            // alcohol_serving 5). So it is read as a concentration: grams =
            // % vol x 0.789 g of ethanol per ml, per 100 ml of product.
            OffSources = [new OffSource("alcohol", 0.789m, IsConcentration: true)],
            Formula = new TargetFormula.None(),
            CustomTargetMin = 1m,
            CustomTargetMax = 500m,
            QuickAdds =
            [
                new QuickAdd("beer", "beer",
                    new MacroLabels("Beer", "Cerveza"),
                    new MacroLabels("330 ml", "330 ml"),
                    Amount: 13m, CaloriesKcal: 150m,
                    Macros: new Dictionary<string, decimal> { [Alcohol] = 13m, [Carbs] = 11m, [Sugar] = 0m }),
                new QuickAdd("cocktail", "martini",
                    new MacroLabels("Cocktail", "Cóctel"),
                    new MacroLabels("1 glass", "1 copa"),
                    Amount: 16m, CaloriesKcal: 180m,
                    Macros: new Dictionary<string, decimal> { [Alcohol] = 16m, [Carbs] = 15m, [Sugar] = 14m }),
            ],
            ShowInHeroBars = false,
            IconName = "wine",
            Name = new MacroLabels("Alcohol", "Alcohol"),
            ShortName = new MacroLabels("Alc", "Alc"),
        },
        new MacroDefinition
        {
            Key = Fiber,
            SortOrder = 45,
            Unit = MacroUnit.Grams,
            Direction = MacroDirection.Hit,
            IsCore = false,
            // No energy of its own and no parent, on purpose. Where the app is
            // used most (US and Latin American labels, and the AI estimates)
            // fibre is already inside total carbs, so its calories and its
            // TEF are priced there. It is NOT declared a child of carbs
            // because EU labels list carbs WITHOUT fibre: clamping to the
            // parent would cut a bag of chia from 34 g of fibre down to its
            // 8 g of carbs, exactly the food a fibre tracker scans.
            KcalPerGram = 0m,
            TefRate = 0m,
            AiWireKey = "fib",
            AiSchemaDescription = "Dietary fiber grams for ONE unit, part of carb",
            AiPromptRule = "grams of dietary fiber in ONE unit, never multiplied by qty. Fiber is part of carb and must never exceed it. Whole grains, legumes, vegetables, fruit with skin, nuts and seeds run high (a cup of cooked lentils ~15, a cup of cooked oatmeal ~4, an apple with skin ~4, a slice of whole wheat bread ~2, a tablespoon of chia ~5); meat, fish, eggs, dairy, oils, sugar and refined drinks are 0.",
            PreScaleMax = 200m,
            MaxPerEntry = 2000m,
            OffSources = [new OffSource("fiber", 1m)],
            // US National Academies adequate intake: 14 g per 1000 kcal. The
            // band keeps a deficit from shrinking the need below the WHO
            // adult minimum (25 g) and a large surplus from asking for more
            // than the highest adequate intake on record (38 g for men).
            Formula = new TargetFormula.PerThousandKcal(14m, Min: 25m, Max: 40m),
            CustomTargetMin = 5m,
            CustomTargetMax = 150m,
            ShowInHeroBars = true,
            IconName = "sprout",
            Name = new MacroLabels("Fiber", "Fibra"),
            ShortName = new MacroLabels("Fiber", "Fibra"),
        },
        new MacroDefinition
        {
            Key = Sugar,
            SortOrder = 50,
            Unit = MacroUnit.Grams,
            Direction = MacroDirection.Limit,
            IsCore = false,
            KcalPerGram = 4m,
            TefRate = 0m,
            ParentKey = Carbs,
            AiWireKey = "sug",
            AiSchemaDescription = "Total sugar grams for ONE unit, subset of carb",
            AiPromptRule = "total sugar grams for ONE unit (naturally occurring plus added), never multiplied by qty. Sugars are a subset of carb and must never exceed it (a can of cola ~35, a plain egg 0).",
            PreScaleMax = 1000m,
            MaxPerEntry = 10000m,
            OffSources = [new OffSource("sugars", 1m)],
            Formula = new TargetFormula.PercentOfBudget(0.10m, Cap: 50m),
            CustomTargetMin = 1m,
            CustomTargetMax = 1000m,
            ShowInHeroBars = true,
            IconName = "candy",
            Name = new MacroLabels("Sugar", "Azúcar"),
            ShortName = new MacroLabels("Sugar", "Azúcar"),
        },
        new MacroDefinition
        {
            Key = Water,
            SortOrder = 60,
            Unit = MacroUnit.Milliliters,
            Direction = MacroDirection.Hit,
            IsCore = false,
            AiWireKey = "h2o",
            AiSchemaDescription = "Drinkable-fluid ml ONE unit contributes; 0 for solid food",
            AiPromptRule = "milliliters of drinkable fluid ONE unit contributes, never multiplied by qty. Water and other beverages count at full volume (a 330 ml soda -> 330, a glass of water -> 250 unless specified); solid food is 0 even if moist.",
            PreScaleMax = 5000m,
            MaxPerEntry = 100000m,
            Formula = new TargetFormula.PerKgBodyWeight(DefaultParam: 35m, RoundToMultiple: 50m),
            CustomTargetMin = 100m,
            CustomTargetMax = 20000m,
            QuickAdds =
            [
                new QuickAdd("glass", "glassWater",
                    new MacroLabels("Water", "Agua"),
                    new MacroLabels("250 ml", "250 ml"),
                    Amount: 250m, CaloriesKcal: 0m,
                    Macros: new Dictionary<string, decimal> { [Water] = 250m }),
                new QuickAdd("bottle", "bottle",
                    new MacroLabels("Water", "Agua"),
                    new MacroLabels("500 ml", "500 ml"),
                    Amount: 500m, CaloriesKcal: 0m,
                    Macros: new Dictionary<string, decimal> { [Water] = 500m }),
            ],
            ShowInHeroBars = false,
            IconName = "glassWater",
            Name = new MacroLabels("Water", "Agua"),
            ShortName = new MacroLabels("Water", "Agua"),
        },
        new MacroDefinition
        {
            Key = Caffeine,
            SortOrder = 70,
            Unit = MacroUnit.Milligrams,
            Direction = MacroDirection.Limit,
            IsCore = false,
            AiWireKey = "caf",
            AiSchemaDescription = "Caffeine milligrams for ONE unit; 0 when caffeine-free",
            AiPromptRule = "milligrams of caffeine in ONE unit, never multiplied by qty (brewed coffee ~95 per 240 ml cup, espresso ~63 per shot, instant coffee ~60, black tea ~47, green tea ~28, cola ~34 per 330 ml, energy drink ~80 per 250 ml, dark chocolate ~20 per 30 g, decaf ~3); 0 for anything without caffeine.",
            PreScaleMax = 2000m,
            MaxPerEntry = 5000m,
            // OFF stores caffeine in grams per 100 g/ml (Red Bull: caffeine_100g 0.032).
            OffSources = [new OffSource("caffeine", 1000m)],
            // EFSA: 400 mg/day for healthy adults, stated as ~5.7 mg/kg; Health
            // Canada 2.5 mg/kg for under-18s. Lighter people get a lower limit,
            // heavier people never exceed the 400 mg ceiling.
            Formula = new TargetFormula.PerKgBodyWeightCapped(AdultPerKg: 5.7m, MinorPerKg: 2.5m, Cap: 400m, RoundToMultiple: 10m),
            CustomTargetMin = 1m,
            CustomTargetMax = 5000m,
            QuickAdds =
            [
                new QuickAdd("coffee", "coffee",
                    new MacroLabels("Coffee", "Café"),
                    new MacroLabels("240 ml", "240 ml"),
                    Amount: 95m, CaloriesKcal: 2m,
                    Macros: new Dictionary<string, decimal> { [Caffeine] = 95m, [Water] = 240m }),
                new QuickAdd("energy-drink", "zap",
                    new MacroLabels("Energy drink", "Bebida energética"),
                    new MacroLabels("250 ml", "250 ml"),
                    Amount: 80m, CaloriesKcal: 110m,
                    Macros: new Dictionary<string, decimal> { [Caffeine] = 80m, [Carbs] = 27m, [Sugar] = 27m, [Water] = 250m }),
            ],
            ShowInHeroBars = false,
            IconName = "coffee",
            Name = new MacroLabels("Caffeine", "Cafeína"),
            ShortName = new MacroLabels("Caff", "Caf"),
        },
        new MacroDefinition
        {
            Key = Sodium,
            SortOrder = 80,
            Unit = MacroUnit.Milligrams,
            Direction = MacroDirection.Limit,
            IsCore = false,
            AiWireKey = "na",
            AiSchemaDescription = "Sodium milligrams for ONE unit (sodium, not salt)",
            AiPromptRule = "milligrams of sodium in ONE unit, never multiplied by qty. Sodium, NOT salt (salt grams x 400 = sodium mg). Processed, cured, canned, fast-food and restaurant dishes run high (a slice of pizza ~600, a fast-food burger ~1000, a cup of canned soup ~800, a tablespoon of soy sauce ~900); plain fruit, vegetables and unsalted foods are near 0.",
            PreScaleMax = 10000m,
            MaxPerEntry = 20000m,
            // Salt first: OFF sodium_100g is often mis-entered (one product lists
            // sodium 40 next to salt 0.1). Salt g x 400 = sodium mg.
            OffSources = [new OffSource("salt", 400m), new OffSource("sodium", 1000m)],
            Formula = new TargetFormula.FixedAmount(2300m),
            CustomTargetMin = 1m,
            CustomTargetMax = 20000m,
            ShowInHeroBars = true,
            IconName = "salt",
            Name = new MacroLabels("Sodium", "Sodio"),
            ShortName = new MacroLabels("Sodium", "Sodio"),
        },
    ];

    /// <summary>Startup-time invariants: a broken catalog fails fast, never at runtime.</summary>
    private static void Validate(IReadOnlyList<MacroDefinition> defs)
    {
        var keys = new HashSet<string>(StringComparer.Ordinal);
        var wireKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var byKey = defs.ToDictionary(d => d.Key, StringComparer.Ordinal);

        foreach (var def in defs)
        {
            if (string.IsNullOrWhiteSpace(def.Key) || def.Key != def.Key.ToLowerInvariant())
                throw new InvalidOperationException($"Macro key '{def.Key}' must be lowercase.");
            if (!keys.Add(def.Key))
                throw new InvalidOperationException($"Duplicate macro key '{def.Key}'.");
            if (def.IsActive && !wireKeys.Add(def.AiWireKey))
                throw new InvalidOperationException($"Duplicate AI wire key '{def.AiWireKey}'.");

            if (def.ParentKey is not null)
            {
                if (!byKey.TryGetValue(def.ParentKey, out var parent))
                    throw new InvalidOperationException($"Macro '{def.Key}' references unknown parent '{def.ParentKey}'.");
                if (parent.SortOrder >= def.SortOrder)
                    throw new InvalidOperationException($"Parent '{parent.Key}' must sort before child '{def.Key}'.");
            }

            if (!def.IsCore && def.AiPromptRule is null)
                throw new InvalidOperationException($"Optional macro '{def.Key}' needs an AI prompt rule.");

            if (def.TefRate is < 0m or > 1m || def.KcalPerGram < 0m)
                throw new InvalidOperationException($"Macro '{def.Key}' has an impossible energy density or TEF rate.");
            if (def.TefRate > 0m && def.EnergyKcalPerGram <= 0m)
                throw new InvalidOperationException($"Macro '{def.Key}' has a TEF rate but no energy of its own to apply it to.");

            if (def.Formula is TargetFormula.PerThousandKcal { Min: { } min, Max: { } max } && min > max)
                throw new InvalidOperationException($"Macro '{def.Key}' has a target band with Min above Max.");

            foreach (var preset in def.AutoPresets)
            {
                if (def.AutoParamRange is not { } range)
                    throw new InvalidOperationException($"Macro '{def.Key}' has presets but no AutoParamRange.");
                if (preset.Param < range.Min || preset.Param > range.Max)
                    throw new InvalidOperationException($"Preset '{preset.Id}' of '{def.Key}' is outside its parameter range.");
            }

            foreach (var quickAdd in def.QuickAdds)
            {
                foreach (var key in quickAdd.Macros.Keys)
                {
                    if (!byKey.ContainsKey(key))
                        throw new InvalidOperationException($"Quick-add '{quickAdd.Id}' of '{def.Key}' references unknown macro '{key}'.");
                }
            }
        }

        var sorted = defs.Select(d => d.SortOrder).ToList();
        if (!sorted.SequenceEqual(sorted.OrderBy(x => x)))
            throw new InvalidOperationException("Macro catalog must be listed in SortOrder.");

        // Whatever is tracked by default must itself fit under the ceiling,
        // or a brand-new account would start out over the limit.
        if (defs.Count(d => d.IsActive && d.DefaultTracked) > MaxTrackedMacros)
            throw new InvalidOperationException("More macros are tracked by default than MaxTrackedMacros allows.");
    }
}
