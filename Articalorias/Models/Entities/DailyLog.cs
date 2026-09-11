using Articalorias.Services.Macros;

namespace Articalorias.Models.Entities;

public class DailyLog
{
    public long DailyLogId { get; set; }
    public long UserId { get; set; }
    public DateOnly LogDate { get; set; }

    // Snapshot del perfil usado ese día
    public decimal? SnapshotWeightKg { get; set; }
    public decimal? SnapshotHeightCm { get; set; }
    public decimal SnapshotBMRKcal { get; set; }
    public decimal? SnapshotBodyFatPercent { get; set; }
    public decimal SnapshotDailyBaseGoalKcal { get; set; }

    // Ingesta total del día
    public decimal TotalFoodCaloriesKcal { get; set; }

    /// <summary>
    /// Sum of the day's entries per macro key, stored as JSON. A key is absent
    /// when no entry of the day carried it (the macro was not tracked then);
    /// a number is the sum over the entries that did carry it. Core macros
    /// are always present.
    /// </summary>
    public MacroAmounts MacroTotals { get; set; } = MacroAmounts.Empty;

    /// <summary>
    /// JSON snapshot of every macro target active on this day, protein
    /// included (serialized <see cref="DayMacroTarget"/> list, catalog order).
    /// NULL = nothing was tracked when the day was created. Written on day
    /// creation and by refresh-snapshot; past days keep the targets they were
    /// lived under.
    /// </summary>
    public string? MacroTargetsJson { get; set; }

    // Gasto del día
    public decimal TotalActivityCaloriesKcal { get; set; }
    public decimal TEFKcal { get; set; }
    public decimal HoursRemainingInDay { get; set; }
    public decimal IdleTimeCaloriesKcal { get; set; }
    // Sleep & NEAT snapshots (nullable: NULL = log predates this feature, skip computation)
    public decimal? SnapshotSleepHours { get; set; }
    public decimal? SnapshotNeatHours { get; set; }
    public decimal SleepCaloriesKcal { get; set; }
    public decimal NeatCaloriesKcal { get; set; }
    public decimal TotalDailyExpenditureKcal { get; set; }

    // Balance / objetivos
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
    /// <summary>
    /// True when the user explicitly marked this day as a deliberate fast.
    /// A fasting day counts as "logged" (banks its real deficit into the
    /// weekly budget, keeps the streak) even with zero food entries.
    /// Automatically cleared by the recalculation pipeline when food appears.
    /// </summary>
    public bool IsFastingDay { get; set; }
    public DateTime? LastRecalculatedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = [];

    // Navigation
    public User User { get; set; } = null!;
    public ICollection<FoodEntry> FoodEntries { get; set; } = [];
    public ICollection<ActivityEntry> ActivityEntries { get; set; } = [];
}
