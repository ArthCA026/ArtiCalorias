import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { profileService } from '@/services/profileService';
import { queryKeys } from '@/lib/queryKeys';
import { profileToRequest } from '@/utils/profile';
import type { UserProfileResponse } from '@/types';

export type CalorieMode = 'net' | 'goal' | 'adjusted';

const LS_KEY = 'ac-calorie-mode';
const FALLBACK: CalorieMode = 'adjusted';

function isValidMode(v: string | null): v is CalorieMode {
  return v === 'net' || v === 'goal' || v === 'adjusted';
}

export function useCalorieMode() {
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => profileService.get().then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });

  // Derive current mode: DB value → localStorage fallback → hardcoded default.
  // localStorage gives an instant value before the profile query resolves.
  const stored = localStorage.getItem(LS_KEY);
  const mode: CalorieMode = profile?.calorieDisplayMode
    ?? (isValidMode(stored) ? stored : FALLBACK);

  const mutation = useMutation({
    mutationFn: (newMode: CalorieMode) => {
      if (!profile) return Promise.reject(new Error('Profile not loaded'));
      return profileService.update({ ...profileToRequest(profile), calorieDisplayMode: newMode });
    },
    onMutate: async (newMode) => {
      // Optimistic update — patch the cached profile immediately
      await queryClient.cancelQueries({ queryKey: queryKeys.profile() });
      const previous = queryClient.getQueryData<UserProfileResponse>(queryKeys.profile());
      queryClient.setQueryData<UserProfileResponse>(queryKeys.profile(), (old) =>
        old ? { ...old, calorieDisplayMode: newMode } : old,
      );
      // Sync localStorage so non-profile-aware consumers get instant value
      localStorage.setItem(LS_KEY, newMode);
      return { previous };
    },
    onError: (_err, _newMode, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(queryKeys.profile(), ctx.previous);
        localStorage.setItem(LS_KEY, ctx.previous.calorieDisplayMode);
      }
    },
  });

  function setMode(newMode: CalorieMode) {
    // Update localStorage immediately for instant re-render even before mutation resolves
    localStorage.setItem(LS_KEY, newMode);
    mutation.mutate(newMode);
  }

  return {
    mode,
    setMode,
    isSaving: mutation.isPending,
  };
}
