import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dailyLogService } from '@/services/dailyLogService';
import { queryKeys, reconcileDayInHistory } from '@/lib/queryKeys';

/**
 * The one dashboard query for a day, shared by Today and the past-day view
 * (same key, same cache entry, one request).
 *
 * The dashboard GET is a read with a side effect: the server creates the
 * day's row on first request, and for the user's real today that is where
 * routine meals and activities auto-add. No mutation runs on the client, so
 * nothing would otherwise tell the Progress week (cached for minutes) that
 * the day now exists; its "Add this day" ghost row stayed on screen after
 * the day had been opened and filled. Every successful fetch therefore
 * writes the day back into any cached week that covers it.
 */
export function useDayDashboard(date: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.dashboard(date),
    queryFn: async () => {
      const { data } = await dailyLogService.getDashboard(date);
      reconcileDayInHistory(queryClient, data);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
