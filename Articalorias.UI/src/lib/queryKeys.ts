import type { QueryClient } from '@tanstack/react-query';
import type { DailyLogResponse } from '@/types/dailyLog';

export const queryKeys = {
  dashboard: (date: string) => ['dashboard', date] as const,
  dashboardAll: () => ['dashboard'] as const,  // prefix — matches every day's dashboard
  history: (from: string, to: string) => ['history', from, to] as const,
  historyAll: () => ['history'] as const,  // prefix — matches every history query
  activityTemplates: () => ['activity-templates'] as const,
  foodTemplates: () => ['food-templates'] as const,
  routines: () => ['favorite-routines'] as const,
  profile: () => ['profile'] as const,
  notificationSchedules: () => ['notification-schedules'] as const,
  streak: () => ['streak'] as const,
  macroPreferences: () => ['macro-preferences'] as const,
  macroCatalog: () => ['macro-catalog'] as const,
  measurements: () => ['measurements'] as const,
  consent: () => ['consent'] as const,
  billing: () => ['billing'] as const,
};

/**
 * Invalidate everything that can change when any day's entries change.
 *
 * Every dashboard is invalidated, not just the mutated date: with the
 * weekly-adjusted calorie mode, editing Tuesday moves the suggested budget of
 * every other day in that week, so Today must refetch after a past-day edit.
 * Invalidation only marks the cache stale — screens not currently mounted
 * refetch on their next visit, so untouched data still comes from cache.
 */
export function invalidateDayData(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboardAll() });
  queryClient.invalidateQueries({ queryKey: queryKeys.historyAll() });
  queryClient.invalidateQueries({ queryKey: queryKeys.streak() });
}

/**
 * The history row of a day, picked out of any payload that carries it (the
 * dashboard is a superset). History rows stay uniform and entry-free.
 */
function toHistoryRow(d: DailyLogResponse): DailyLogResponse {
  return {
    dailyLogId: d.dailyLogId,
    logDate: d.logDate,
    totalFoodCaloriesKcal: d.totalFoodCaloriesKcal,
    macroTotals: d.macroTotals,
    macroTargets: d.macroTargets,
    totalDailyExpenditureKcal: d.totalDailyExpenditureKcal,
    dailyGoalDeltaKcal: d.dailyGoalDeltaKcal,
    caloriesRemainingToDailyTargetKcal: d.caloriesRemainingToDailyTargetKcal,
    suggestedDailyAverageRemainingKcal: d.suggestedDailyAverageRemainingKcal,
    snapshotDailyBaseGoalKcal: d.snapshotDailyBaseGoalKcal,
    isFastingDay: d.isFastingDay,
    hasCalorieBudgetEstimate: d.hasCalorieBudgetEstimate,
  };
}

function sameHistoryRow(a: DailyLogResponse, b: DailyLogResponse): boolean {
  return (
    a.dailyLogId === b.dailyLogId &&
    a.totalFoodCaloriesKcal === b.totalFoodCaloriesKcal &&
    a.totalDailyExpenditureKcal === b.totalDailyExpenditureKcal &&
    a.dailyGoalDeltaKcal === b.dailyGoalDeltaKcal &&
    a.caloriesRemainingToDailyTargetKcal === b.caloriesRemainingToDailyTargetKcal &&
    a.suggestedDailyAverageRemainingKcal === b.suggestedDailyAverageRemainingKcal &&
    a.snapshotDailyBaseGoalKcal === b.snapshotDailyBaseGoalKcal &&
    a.isFastingDay === b.isFastingDay &&
    a.hasCalorieBudgetEstimate === b.hasCalorieBudgetEstimate &&
    JSON.stringify(a.macroTotals) === JSON.stringify(b.macroTotals) &&
    JSON.stringify(a.macroTargets) === JSON.stringify(b.macroTargets)
  );
}

/**
 * Write a freshly fetched day into every cached history week that covers it.
 *
 * Fetching a day's dashboard is the request that CREATES the day server side
 * (with auto-added routine meals when it is the user's today). No mutation
 * runs on the client for that, so the week on Progress, cached for minutes,
 * kept showing the day as missing ("Add this day") after it had been opened
 * and filled. Upserting here makes the week agree with the day instantly.
 *
 * A day that was absent from a covering week was born (or the week was
 * already behind), and building a day runs the weekly pipeline, which can
 * move sibling days' adjusted budgets: that week is also marked stale so the
 * next visit to Progress refetches it whole. A day already present is only
 * patched when its numbers differ, so an unchanged week keeps its own
 * freshness clock instead of being stamped fresh by one confirmed row.
 */
export function reconcileDayInHistory(queryClient: QueryClient, day: DailyLogResponse) {
  const row = toHistoryRow(day);
  let wasMissing = false;

  for (const [key, data] of queryClient.getQueriesData<DailyLogResponse[]>({
    queryKey: queryKeys.historyAll(),
  })) {
    const [, from, to] = key;
    if (!Array.isArray(data) || typeof from !== 'string' || typeof to !== 'string') continue;
    if (row.logDate < from || row.logDate > to) continue;

    const idx = data.findIndex((d) => d.logDate === row.logDate);
    if (idx === -1) {
      wasMissing = true;
      queryClient.setQueryData<DailyLogResponse[]>(
        key,
        [...data, row].sort((a, b) => a.logDate.localeCompare(b.logDate)),
      );
    } else if (!sameHistoryRow(data[idx], row)) {
      queryClient.setQueryData<DailyLogResponse[]>(
        key,
        data.map((d, i) => (i === idx ? row : d)),
      );
    }
  }

  if (wasMissing) queryClient.invalidateQueries({ queryKey: queryKeys.historyAll() });
}
