import { useQuery } from '@tanstack/react-query';
import { measurementService } from '@/services/measurementService';
import { queryKeys } from '@/lib/queryKeys';
import { toDateString, parseDate } from '@/utils/format';

/** Days without a body measurement before the Profile tab shows its dot. */
export const BODY_VERY_STALE_DAYS = 31;

/**
 * Days since the newest body measurement (null = none recorded). Shared by
 * the tab-bar dot, the Profile page row and the weekly check-in; the query
 * cache makes it one request for all of them.
 */
export function useBodyStaleDays(): number | null {
  const { data } = useQuery({
    queryKey: queryKeys.measurements(),
    queryFn: () => measurementService.getAll().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
  if (!data || data.length === 0) return null;
  const newest = data[data.length - 1].measuredOn;
  return Math.round(
    (parseDate(toDateString()).getTime() - parseDate(newest).getTime()) / 86400000,
  );
}
