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
}

export interface DailyDashboardResponse extends DailyLogResponse {
  foodEntries: FoodEntryResponse[];
  activityEntries: ActivityEntryResponse[];
}
