import type { FoodEntryResponse } from './food';
import type { ActivityEntryResponse } from './activity';

export interface DailyLogResponse {
  dailyLogId: number;
  logDate: string;

  totalFoodCaloriesKcal: number;
  totalProteinGrams: number;

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

  // Macro split and expenditure detail (populated by the dashboard mapper)
  totalFatGrams: number;
  totalCarbsGrams: number;
  totalAlcoholGrams: number;
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
