import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, invalidateDayData } from '@/lib/queryKeys';
import { macroService } from '@/services/macroService';
import { dailyLogService } from '@/services/dailyLogService';
import { toDateString } from '@/utils/format';
import type { UpdateMacroPreferencesRequest } from '@/types';

export function useMacroPreferences() {
  return useQuery({
    queryKey: queryKeys.macroPreferences(),
    queryFn: () => macroService.getPreferences().then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });
}

export function useUpdateMacroPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: UpdateMacroPreferencesRequest) =>
      macroService.updatePreferences(request).then((r) => r.data),
    onSuccess: async (data) => {
      queryClient.setQueryData(queryKeys.macroPreferences(), data);
      // Re-freeze today's targets so the change applies from today only;
      // past days keep the targets they were lived under.
      try {
        await dailyLogService.refreshSnapshot(toDateString());
      } catch {
        /* non-critical: the next recalculation refreshes it */
      }
      invalidateDayData(queryClient);
    },
  });
}
