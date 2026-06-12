import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { notificationService, type ReminderSchedule } from '@/services/notificationService';
import { localToUtc, utcToLocal } from '@/utils/notifications';

export interface LocalSchedule {
  type: 'breakfast' | 'lunch' | 'dinner';
  enabled: boolean;
  hour: number;
  minute: number;
}

const DEFAULT_SCHEDULES: LocalSchedule[] = [
  { type: 'breakfast', enabled: false, hour: 8,  minute: 0 },
  { type: 'lunch',     enabled: false, hour: 13, minute: 0 },
  { type: 'dinner',    enabled: false, hour: 20, minute: 0 },
];

function toLocalSchedule(s: ReminderSchedule): LocalSchedule {
  const { hour, minute } = utcToLocal(s.hourUtc, s.minuteUtc);
  return { type: s.type, enabled: s.enabled, hour, minute };
}

export function useNotificationSettings() {
  const queryClient = useQueryClient();

  const { data: schedules = DEFAULT_SCHEDULES, isLoading } = useQuery({
    queryKey: queryKeys.notificationSchedules(),
    queryFn: async () => {
      const res = await notificationService.getSchedules();
      return res.data.map(toLocalSchedule);
    },
    staleTime: 10 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (updated: LocalSchedule[]) => {
      const payload: ReminderSchedule[] = updated.map((s) => {
        const { hourUtc, minuteUtc } = localToUtc(s.hour, s.minute);
        return { type: s.type, enabled: s.enabled, hourUtc, minuteUtc };
      });
      return notificationService.updateSchedules(payload);
    },
    onMutate: async (updated) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notificationSchedules() });
      const previous = queryClient.getQueryData<LocalSchedule[]>(queryKeys.notificationSchedules());
      queryClient.setQueryData(queryKeys.notificationSchedules(), updated);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(queryKeys.notificationSchedules(), ctx.previous);
      }
    },
  });

  function updateSchedule(
    type: LocalSchedule['type'],
    patch: Partial<Omit<LocalSchedule, 'type'>>,
  ) {
    const updated = schedules.map((s) => (s.type === type ? { ...s, ...patch } : s));
    mutation.mutate(updated);
  }

  return {
    schedules,
    isLoading,
    updateSchedule,
    isSaving: mutation.isPending,
  };
}
