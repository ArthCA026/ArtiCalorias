export interface WeeklySummaryResponse {
  weeklySummaryId: number;
  weekStartDate: string;
  weekEndDate: string;

  baseDailyGoalKcalUsed: number;
  expectedWeeklyTargetKcal: number;

  totalFoodCaloriesKcal: number;
  totalProteinGrams: number;
  totalActivityCaloriesKcal: number;
  totalTEFKcal: number;
  totalExpenditureKcal: number;

  actualWeeklyBalanceKcal: number;
  differenceVsTargetKcal: number;
  remainingTargetKcal: number;
  requiredDailyAverageRemainingKcal: number;

  daysLogged: number;
  estimatedWeightChangeKg: number | null;
}
