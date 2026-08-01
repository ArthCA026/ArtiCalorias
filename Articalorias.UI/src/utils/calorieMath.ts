import type { CalorieMode } from '@/hooks/useCalorieMode';
import type { DailyLogResponse } from '@/types';

/**
 * The one place the calorie display mode turns into numbers.
 *
 * Every screen that shows a calorie figure has to agree with every other one,
 * so nothing may derive a budget or a distance-from-plan on its own. In
 * particular `dailyGoalDeltaKcal` from the API is a fixed-daily-goal number and
 * must never be rendered directly: it silently contradicts the ring on Today
 * for anyone on 'net' or 'adjusted'.
 *
 * These take DailyLogResponse rather than the dashboard on purpose. The history
 * endpoint that feeds Progress returns the plain log, DailyDashboardResponse
 * extends it, and both carry every field used here, so one implementation
 * covers Today, a past day and the whole week.
 */

/** The day's calorie budget under the active display mode. */
export function budgetFor(log: DailyLogResponse, mode: CalorieMode): number {
  switch (mode) {
    case 'net':
      return log.totalDailyExpenditureKcal;
    case 'goal':
      return log.totalFoodCaloriesKcal + log.caloriesRemainingToDailyTargetKcal;
    case 'adjusted':
    default:
      return log.totalDailyExpenditureKcal + log.suggestedDailyAverageRemainingKcal;
  }
}

/** Signed distance from that budget. Positive is above budget, negative below. */
export function deltaFor(log: DailyLogResponse, mode: CalorieMode): number {
  return log.totalFoodCaloriesKcal - budgetFor(log, mode);
}

/**
 * Direction semantics: a positive snapshot base goal means a surplus (bulking)
 * day, where landing at or above budget is favorable; zero or negative means
 * deficit or maintenance, where at or under budget is favorable.
 */
export function isSurplusGoalDay(log: DailyLogResponse): boolean {
  return log.snapshotDailyBaseGoalKcal > 0;
}

export function isFavorableFor(log: DailyLogResponse, mode: CalorieMode): boolean {
  const delta = deltaFor(log, mode);
  return isSurplusGoalDay(log) ? delta >= 0 : delta <= 0;
}

/**
 * Whether a day can show a distance from plan at all.
 *
 * A row can exist with no food on it, and a profile without weight or height
 * gets its budget fields zeroed server side. Either way the delta would be a
 * fabricated number, so those days show what was eaten and nothing else.
 */
export function hasComparablePlan(log: DailyLogResponse): boolean {
  return log.totalFoodCaloriesKcal > 0 && log.hasCalorieBudgetEstimate;
}
