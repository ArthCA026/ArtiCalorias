import type { QueryClient } from '@tanstack/react-query';

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
