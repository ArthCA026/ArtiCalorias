import { addDays } from '@/utils/format';
import type { DailyLogResponse } from '@/types';

/**
 * Direction semantics for goal deltas:
 * a positive snapshot base goal means a surplus (bulking) day, where a
 * positive delta is favorable; zero or negative means deficit/maintenance,
 * where a negative or zero delta is favorable.
 */
export function isSurplusGoalDay(d: DailyLogResponse): boolean {
  return d.snapshotDailyBaseGoalKcal > 0;
}

export function isFavorableDelta(d: DailyLogResponse): boolean {
  return isSurplusGoalDay(d) ? d.dailyGoalDeltaKcal >= 0 : d.dailyGoalDeltaKcal <= 0;
}

/** A day counts as logged once food is on it (same rule as the Today week strip). */
export function isLoggedDay(d: DailyLogResponse): boolean {
  return d.totalFoodCaloriesKcal > 0;
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
