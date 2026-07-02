import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { streakService } from '@/services/streakService';
import type { UpdateStreakSettingsRequest } from '@/types/streak';

export function useGetStreak() {
  return useQuery({
    queryKey: queryKeys.streak(),
    queryFn: async () => {
      const { data } = await streakService.getStreak();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateStreakSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: UpdateStreakSettingsRequest) =>
      streakService.updateSettings(request).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.streak(), data);
    },
  });
}

export function useResetStreak() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => streakService.resetStreak().then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.streak(), data);
    },
  });
}
