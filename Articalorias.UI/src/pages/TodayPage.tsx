import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { DayView } from '@/components/day/DayView';
import { StreakChip } from '@/components/today/StreakChip';
import { dailyLogService } from '@/services/dailyLogService';
import { queryKeys } from '@/lib/queryKeys';
import { toDateString, parseDate } from '@/utils/format';

export default function TodayPage() {
  const { t, i18n } = useTranslation();
  const today = toDateString();

  // Same key as DayView's query: shared cache entry, no extra request
  const { data: dash } = useQuery({
    queryKey: queryKeys.dashboard(today),
    queryFn: () => dailyLogService.getDashboard(today).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(parseDate(today)),
    [i18n.language, today],
  );

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-ink leading-tight">
            {t('today.title', 'Today')}
          </h1>
          <p className="text-[13px] text-ink-2 capitalize">{dateLabel}</p>
        </div>
        <StreakChip hasLoggedToday={(dash?.foodEntries.length ?? 0) > 0} />
      </header>

      <DayView date={today} isToday />
    </div>
  );
}
