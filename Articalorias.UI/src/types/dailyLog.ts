import type { FoodEntryResponse } from './food';
import type { ActivityEntryResponse } from './activity';
import type { MacroKey } from './macros';

/** One tracked macro as frozen on a specific day (past days keep theirs). */
export interface DayMacroTarget {
  macroKey: MacroKey;
  /** Grams (ml for water). Null = tracked amount-only, no bar. */
  target: number | null;
  /** "hit" = goal to reach, "limit" = warn when exceeded. */
  direction: 'hit' | 'limit';
}

export interface DailyLogResponse {
  dailyLogId: number;
  logDate: string;

  totalFoodCaloriesKcal: number;
  totalProteinGrams: number;
  totalFatGrams: number;
  totalCarbsGrams: number;
  totalAlcoholGrams: number;
  /** Null = no entry of the day carried sugar data (not tracked then). */
  totalSugarGrams: number | null;
  /** Null = no entry of the day carried water data (not tracked then). */
  totalWaterMl: number | null;
  /** Extended macro targets frozen on this day (empty = only protein tracked). */
  macroTargets: DayMacroTarget[];

  totalDailyExpenditureKcal: number;

  dailyGoalDeltaKcal: number;
  caloriesRemainingToDailyTargetKcal: number;
  proteinRemainingGrams: number;
  suggestedDailyAverageRemainingKcal: number;

  snapshotProteinGoalGrams: number;
  snapshotDailyBaseGoalKcal: number;
  /** User explicitly marked this day as a deliberate fast. */
  isFastingDay: boolean;
  hasCalorieBudgetEstimate: boolean;
}

export interface DailyDashboardResponse extends DailyLogResponse {
  foodEntries: FoodEntryResponse[];
  activityEntries: ActivityEntryResponse[];
  sleepCaloriesKcal: number;
  neatCaloriesKcal: number;
  snapshotSleepHours: number | null;
  snapshotNeatHours: number | null;
  snapshotWeightKg: number | null;
  snapshotHeightCm: number | null;
  hasCalorieBudgetEstimate: boolean;
  hasCalorieEstimate: boolean;
  hasProteinGoal: boolean;
  /** False until the user logs food themself for the first time ever. */
  hasEverLoggedFood: boolean;

  // Expenditure detail (populated by the dashboard mapper)
  totalActivityCaloriesKcal: number;
  tefKcal: number;
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
