using Articalorias.DTOs.Activities;
using Articalorias.DTOs.FoodEntries;

namespace Articalorias.DTOs.DailyLogs;

/// <summary>
/// Composite response for a single day — returns everything the frontend
/// dashboard needs in one call: log totals, food entries, and activity entries.
/// </summary>
public class DailyDashboardResponse
{
    // ── Day summary (same fields as DailyLogResponse) ──
    public long DailyLogId { get; set; }
    public DateOnly LogDate { get; set; }

    // Ingesta
    public decimal TotalFoodCaloriesKcal { get; set; }

    /// <summary>
    /// Consumed amounts keyed by catalog macro key. Absent key = no entry of
    /// the day carried it (the macro was not tracked then); core macros are
    /// always present.
    /// </summary>
    public Dictionary<string, decimal> MacroTotals { get; set; } = new();

    /// <summary>Every macro target frozen on this day, protein included, in catalog order. Empty = nothing tracked that day.</summary>
    public List<DayMacroTargetResponse> MacroTargets { get; set; } = [];

    /// <summary>
    /// False until the user logs food THEMSELF for the first time ever (auto-added
    /// template meals do not count). Gates the getting-started checklist.
    /// </summary>
    public bool HasEverLoggedFood { get; set; }

    // Gasto. The blocks below add up exactly to TotalDailyExpenditureKcal:
    //   SnapshotBMRKcal + SleepCaloriesKcal + NeatCaloriesKcal + IdleTimeCaloriesKcal
    //   + (TotalActivityCaloriesKcal - ActivityRestingOffsetKcal) + TEFKcal
    /// <summary>Gross burn of the logged activities, resting share included (what a watch reports).</summary>
    public decimal TotalActivityCaloriesKcal { get; set; }
    /// <summary>Resting share inside the gross activity figures; subtract it to get the burn above resting.</summary>
    public decimal ActivityRestingOffsetKcal { get; set; }
    /// <summary>Hours covered by logged activities.</summary>
    public decimal ActivityHours { get; set; }
    public decimal TEFKcal { get; set; }
    /// <summary>Awake hours left after sleep, everyday movement and activities.</summary>
    public decimal HoursRemainingInDay { get; set; }
    /// <summary>Delta above resting for the idle hours.</summary>
    public decimal IdleTimeCaloriesKcal { get; set; }
    /// <summary>Delta from resting for the sleep hours: zero or NEGATIVE, sleep burns less than resting.</summary>
    public decimal SleepCaloriesKcal { get; set; }
    /// <summary>Delta above resting for the everyday-movement hours.</summary>
    public decimal NeatCaloriesKcal { get; set; }
    public decimal TotalDailyExpenditureKcal { get; set; }

    // Profile hours snapshotted on this day (null = log predates this feature)
    public decimal? SnapshotSleepHours { get; set; }
    public decimal? SnapshotNeatHours { get; set; }

    /// <summary>
    /// Sleep and everyday-movement hours the pipeline actually priced. They
    /// equal the snapshots except when logged activities left less than the
    /// reserved hours free, in which case they were squeezed to fit 24 h.
    /// Null = log predates the feature.
    /// </summary>
    public decimal? SleepHoursUsed { get; set; }
    public decimal? NeatHoursUsed { get; set; }

    // Balance
    public decimal NetBalanceKcal { get; set; }
    public decimal DailyGoalDeltaKcal { get; set; }
    public decimal CaloriesRemainingToDailyTargetKcal { get; set; }

    // Contexto semanal
    public DateOnly WeekStartDate { get; set; }
    public DateOnly WeekEndDate { get; set; }
    public decimal WeeklyTargetKcal { get; set; }
    public decimal WeeklyActualToDateKcal { get; set; }
    public decimal WeeklyExpectedToDateKcal { get; set; }
    public decimal WeeklyDifferenceKcal { get; set; }
    public decimal WeeklyRemainingTargetKcal { get; set; }
    public decimal SuggestedDailyAverageRemainingKcal { get; set; }

    // Estado
    /// <summary>User explicitly marked this day as a deliberate fast.</summary>
    public bool IsFastingDay { get; set; }

    // Snapshot usado
    public decimal? SnapshotWeightKg { get; set; }
    public decimal? SnapshotHeightCm { get; set; }
    public decimal SnapshotBMRKcal { get; set; }

    // Availability flags — derived from snapshot fields
    public bool HasCalorieBudgetEstimate => SnapshotWeightKg.HasValue && SnapshotHeightCm.HasValue;
    public bool HasCalorieEstimate => SnapshotWeightKg.HasValue;
    public decimal? SnapshotBodyFatPercent { get; set; }
    public decimal SnapshotDailyBaseGoalKcal { get; set; }

    // ── Inline children ──
    public List<FoodEntryResponse> FoodEntries { get; set; } = [];
    public List<ActivityEntryResponse> ActivityEntries { get; set; } = [];
}
