import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys, invalidateDayData } from '@/lib/queryKeys';
import { macroService } from '@/services/macroService';
import { dailyLogService } from '@/services/dailyLogService';
import { toDateString } from '@/utils/format';
import type { UpdateMacroPreferenceItem, UpdateMacroPreferencesRequest } from '@/types';

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

/**
 * Saves ONE macro's preference immediately (the settings switches and the
 * target sheet). The backend upserts only the submitted macro, so nothing
 * else is touched. `pendingKey` lets a screen disable just the switch in
 * flight while the others stay interactive.
 */
export function useUpdateMacroPreference() {
  const base = useUpdateMacroPreferences();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const mutate = (
    item: UpdateMacroPreferenceItem,
    opts?: { onSuccess?: () => void; onError?: (err: unknown) => void },
  ) => {
    setPendingKey(item.macroKey);
    base.mutate(
      { items: [item] },
      {
        onSuccess: () => opts?.onSuccess?.(),
        onError: (err) => opts?.onError?.(err),
        onSettled: () => setPendingKey(null),
      },
    );
  };

  return { mutate, isPending: base.isPending, pendingKey };
}
