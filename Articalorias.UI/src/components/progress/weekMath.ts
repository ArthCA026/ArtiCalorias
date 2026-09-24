import type { DailyLogResponse } from '@/types';

/**
 * Week-shape helpers with no calorie-mode dependency. Anything that turns a
 * day into a budget or a distance from plan lives in @/utils/calorieMath.
 */

/**
 * A day counts as logged once food is on it, or when the user explicitly
 * marked it a deliberate fasting day (same rule as the streak and the
 * backend's weekly banking).
 */
export function isLoggedDay(d: DailyLogResponse): boolean {
  return d.totalFoodCaloriesKcal > 0 || d.isFastingDay;
}

