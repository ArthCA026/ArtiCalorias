import { addDays } from '@/utils/format';
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

/** Longest run of consecutive logged days inside the Monday-based week. */
export function longestLoggedRun(days: DailyLogResponse[], monday: string): number {
  const logged = new Set(days.filter(isLoggedDay).map((d) => d.logDate));
  let best = 0;
  let run = 0;
  for (let i = 0; i < 7; i++) {
    if (logged.has(addDays(monday, i))) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}
