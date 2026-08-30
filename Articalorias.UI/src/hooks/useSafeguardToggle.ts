import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { profileService } from '@/services/profileService';
import { dailyLogService } from '@/services/dailyLogService';
import { queryKeys, invalidateDayData } from '@/lib/queryKeys';
import { toDateString } from '@/utils/format';
import { profileToRequest } from '@/utils/profile';
import type { UserProfileResponse } from '@/types';

export function useSafeguardToggle() {
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => profileService.get().then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });

  // While profile is loading, default to false (safeguard off) to avoid
  // flash of a restrictive state before the real value arrives.
  const enabled: boolean = profile?.minCaloriesSafeguardEnabled ?? false;

  const mutation = useMutation({
    mutationFn: (newValue: boolean) => {
      if (!profile) return Promise.reject(new Error('Profile not loaded'));
      return profileService.update({
        ...profileToRequest(profile),
        minCaloriesSafeguardEnabled: newValue,
      });
    },
    onMutate: async (newValue) => {
      // Optimistic update — patch the cached profile immediately so the toggle
      // reflects the new state without waiting for the round-trip.
      await queryClient.cancelQueries({ queryKey: queryKeys.profile() });
      const previous = queryClient.getQueryData<UserProfileResponse>(queryKeys.profile());
      queryClient.setQueryData<UserProfileResponse>(queryKeys.profile(), (old) =>
        old ? { ...old, minCaloriesSafeguardEnabled: newValue } : old,
      );
      return { previous };
    },
    onSuccess: async () => {
      // Await the backend snapshot refresh so the recalculation (with the new safeguard
      // setting) is complete before we invalidate and trigger a refetch.
      const today = toDateString(); // local date — must match queryKeys.dashboard(today)
      try {
        await dailyLogService.refreshSnapshot(today);
      } catch {
        // Non-critical — dashboard will still refetch, just may show slightly stale data.
      }
      // The safeguard changes the budget of every day, so all cached
      // dashboards and week views are stale, not just today's.
      invalidateDayData(queryClient);
    },
    onError: (_err, _newValue, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(queryKeys.profile(), ctx.previous);
      }
    },
  });

  function setEnabled(newValue: boolean) {
    mutation.mutate(newValue);
  }

  return {
    enabled,
    setEnabled,
    isSaving: mutation.isPending,
  };
}
