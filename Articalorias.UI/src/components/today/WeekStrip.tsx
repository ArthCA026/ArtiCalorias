import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { historyService } from '@/services/historyService';
import { queryKeys } from '@/lib/queryKeys';
import { addDays, mondayOf, parseDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { DailyLogResponse } from '@/types';

interface WeekStripProps {
  /** Today, yyyy-MM-dd */
  date: string;
  /** Positive base goal means a surplus (bulking) goal */
  baseGoalKcal: number;
}

/**
 * The week at a glance: seven day dots plus one calm summary line.
 * Filled dots reward consistency (completion bias); the copy keeps the
 * focus on the week, not on any single imperfect day.
 */
export function WeekStrip({ date, baseGoalKcal }: WeekStripProps) {
  const { t, i18n } = useTranslation();
  const monday = mondayOf(date);
  const sunday = addDays(monday, 6);

  const { data: days } = useQuery({
    queryKey: queryKeys.history(monday, sunday),
    queryFn: () => historyService.getDailyRange(monday, sunday).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const byDate = useMemo(() => {
    const map = new Map<string, DailyLogResponse>();
    (days ?? []).forEach((d) => map.set(d.logDate, d));
    return map;
  }, [days]);

  const weekdayFormatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { weekday: 'narrow' }),
    [i18n.language],
  );

  const dots = Array.from({ length: 7 }, (_, i) => {
    const dayStr = addDays(monday, i);
    const log = byDate.get(dayStr);
    const logged = (log?.totalFoodCaloriesKcal ?? 0) > 0;
    const isToday = dayStr === date;
    const isFuture = dayStr > date;
    return { dayStr, logged, isToday, isFuture };
  });

  const loggedCount = dots.filter((d) => d.logged).length;

  // Weekly deviation vs the plan, from per-day goal deltas.
  // For deficit/maintenance goals a negative sum is favorable;
  // for surplus goals a positive sum is favorable.
  const deltaSum = (days ?? []).reduce((sum, d) => sum + d.dailyGoalDeltaKcal, 0);
  const favorable = baseGoalKcal > 0 ? deltaSum >= 0 : deltaSum <= 0;

  let summary: string;
  if (loggedCount === 0) {
    summary = t('today.week_fresh', 'A fresh week. Every logged day counts.');
  } else if (favorable) {
    summary = t('today.week_ahead', 'You are on plan this week. Keep it rolling.');
  } else {
    summary = t('today.week_adjusts', 'Slightly over so far. Your daily target already absorbs it, just keep logging.');
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-bold text-ink-2 uppercase tracking-wide">
          {t('today.this_week', 'This week')}
        </p>
        <p className="text-[13px] font-semibold text-ink-2 tabular-nums">
          {t('today.days_logged', '{{n}} of 7 logged', { n: loggedCount })}
        </p>
      </div>
      <div className="flex justify-between">
        {dots.map((d) => (
          <div key={d.dayStr} className="flex flex-col items-center gap-1.5">
            <span className="text-[11px] font-semibold text-ink-3">
              {weekdayFormatter.format(parseDate(d.dayStr))}
            </span>
            <span
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center',
                d.logged ? 'bg-primary text-on-primary' : 'bg-inset text-ink-3',
                d.isToday && !d.logged && 'ring-2 ring-primary/60',
                d.isFuture && 'opacity-45',
              )}
            >
              {d.logged ? (
                <Icon name="check" size={15} strokeWidth={2.8} />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
              )}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3.5 text-[13px] text-ink-2 leading-relaxed">{summary}</p>
    </Card>
  );
}
