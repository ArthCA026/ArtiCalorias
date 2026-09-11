import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { macroService } from '@/services/macroService';

/**
 * The macro catalog changes only with a deploy. It is kept in memory for an
 * hour (a long-lived tab picks up a deploy within that) and never
 * garbage-collected while the app is open; the server answers revalidation
 * with a 304, so a fresh page load is always current at no cost. Consumers
 * should go through useMacros() (the provider), which adds lookups and
 * fallbacks.
 */
export function useMacroCatalog() {
  return useQuery({
    queryKey: queryKeys.macroCatalog(),
    queryFn: () => macroService.getCatalog().then((r) => r.data),
    staleTime: 60 * 60 * 1000,
    gcTime: Infinity,
    placeholderData: keepPreviousData,
  });
}
