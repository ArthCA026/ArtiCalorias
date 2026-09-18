import type { FoodEntryResponse } from './food';
import type { ActivityEntryResponse } from './activity';
import type { MacroAmounts, MacroDirection, MacroKey } from './macros';

/** One tracked macro as frozen on a specific day (past days keep theirs). */
export interface DayMacroTarget {
  macroKey: MacroKey;
  /** Amount per day in the macro unit. Null = tracked amount-only, no bar. */
  target: number | null;
  /** "hit" = goal to reach, "limit" = warn when exceeded. */
  direction: MacroDirection;
}

export interface DailyLogResponse {
  dailyLogId: number;
  logDate: string;

  totalFoodCaloriesKcal: number;
  /**
   * Consumed amounts keyed by macro key. Absent key = no entry of the day
   * carried it (the macro was not tracked then); core macros are always present.
   */
  macroTotals: MacroAmounts;
  /** Every macro target frozen on this day, protein included, catalog order. Empty = nothing tracked that day. */
  macroTargets: DayMacroTarget[];

  totalDailyExpenditureKcal: number;

  dailyGoalDeltaKcal: number;
  caloriesRemainingToDailyTargetKcal: number;
  suggestedDailyAverageRemainingKcal: number;

  snapshotDailyBaseGoalKcal: number;
  /** User explicitly marked this day as a deliberate fast. */
  isFastingDay: boolean;
  hasCalorieBudgetEstimate: boolean;
}

export interface DailyDashboardResponse extends DailyLogResponse {
  foodEntries: FoodEntryResponse[];
  activityEntries: ActivityEntryResponse[];
  snapshotWeightKg: number | null;
  snapshotHeightCm: number | null;
  snapshotBMRKcal: number;
  hasCalorieBudgetEstimate: boolean;
  hasCalorieEstimate: boolean;
  /** False until the user logs food themself for the first time ever. */
  hasEverLoggedFood: boolean;

  // Expenditure detail (populated by the dashboard mapper). The blocks add up
  // exactly to totalDailyExpenditureKcal:
  //   snapshotBMRKcal + sleepCaloriesKcal + neatCaloriesKcal + idleTimeCaloriesKcal
  //   + (totalActivityCaloriesKcal - activityRestingOffsetKcal) + tefKcal
  // Every *CaloriesKcal below is a delta from resting, so sleep is negative.
  /** Gross burn of the logged activities, resting share included (what a watch reports). */
  totalActivityCaloriesKcal: number;
  /** Resting share inside the gross activity figures. */
  activityRestingOffsetKcal: number;
  /** Hours covered by logged activities. */
  activityHours: number;
  tefKcal: number;
  /** Awake hours left after sleep, everyday movement and activities. */
  hoursRemainingInDay: number;
  idleTimeCaloriesKcal: number;
  /** Zero or negative: sleep burns less than resting. */
  sleepCaloriesKcal: number;
  neatCaloriesKcal: number;
  /** Profile hours snapshotted on this day. Null = the day predates the feature. */
  snapshotSleepHours: number | null;
  snapshotNeatHours: number | null;
  /** Hours actually priced; equal to the snapshots unless activities squeezed them to fit 24 h. */
  sleepHoursUsed: number | null;
  neatHoursUsed: number | null;
  netBalanceKcal: number;

  // Weekly context (Monday-based week, populated by the dashboard mapper)
  weekStartDate: string;
  weekEndDate: string;
  weeklyTargetKcal: number;
  weeklyActualToDateKcal: number;
  weeklyExpectedToDateKcal: number;
  weeklyDifferenceKcal: number;
  weeklyRemainingTargetKcal: number;
}
