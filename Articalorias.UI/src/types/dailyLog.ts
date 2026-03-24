import type { FoodEntryResponse } from './food';
import type { ActivityEntryResponse } from './activity';

export interface DailyLogResponse {
  dailyLogId: number;
  logDate: string;

  totalFoodCaloriesKcal: number;
  totalProteinGrams: number;
  totalFatGrams: number;
  totalCarbsGrams: number;
  totalAlcoholGrams: number;

  totalActivityCaloriesKcal: number;
  tefKcal: number;
  hoursRemainingInDay: number;
  idleTimeCaloriesKcal: number;
  totalDailyExpenditureKcal: number;

  netBalanceKcal: number;
  dailyGoalDeltaKcal: number;
  caloriesRemainingToDailyTargetKcal: number;
  proteinRemainingGrams: number;

  weekStartDate: string;
  weekEndDate: string;
  weeklyTargetKcal: number;
  weeklyActualToDateKcal: number;
  weeklyExpectedToDateKcal: number;
  weeklyDifferenceKcal: number;
  weeklyRemainingTargetKcal: number;
  suggestedDailyAverageRemainingKcal: number;

  isFinalized: boolean;

  snapshotWeightKg: number;
  snapshotHeightCm: number;
  snapshotBMRKcal: number;
  snapshotBodyFatPercent: number | null;
  snapshotDailyBaseGoalKcal: number;
  snapshotProteinGoalGrams: number;
}

export interface DailyDashboardResponse extends DailyLogResponse {
  foodEntries: FoodEntryResponse[];
  activityEntries: ActivityEntryResponse[];
}
