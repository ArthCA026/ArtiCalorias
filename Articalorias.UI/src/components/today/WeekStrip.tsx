import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { historyService } from '@/services/historyService';
import { queryKeys } from '@/lib/queryKeys';
import { addDays, mondayOf, parseDate, toDateString } from '@/utils/format';
import { deltaFor, hasComparablePlan } from '@/utils/calorieMath';
import { cn } from '@/utils/cn';
import type { DailyLogResponse } from '@/types';

interface WeekStripProps {
  /** The viewed day, yyyy-MM-dd (its week is shown) */
  date: string;
  /** Positive base goal means a surplus (bulking) goal */
  baseGoalKcal: number;
  /** Render on the inset surface (when shown inside a sheet) */
  inset?: boolean;
}

/**
 * The week at a glance: seven day dots plus one calm summary line.
 * Filled dots reward consistency (completion bias); the copy keeps the
 * focus on the week, not on any single imperfect day.
 */
export function WeekStrip({ date, baseGoalKcal, inset }: WeekStripProps) {
  const { t, i18n } = useTranslation();
  const monday = mondayOf(date);
  const sunday = addDays(monday, 6);
  // A past day inside the running week still belongs to "this week",
  // so the tense follows the week, not the viewed day.
  const isCurrentWeek = monday === mondayOf(toDateString());

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

  // Weekly deviation vs the FIXED daily goal, matching the Progress page.
  // Week-level sums never use the adjusted budget: it already absorbs earlier
  // days' deviations, so summing against it double-counts them. Days with
  // nothing on them, or with no budget to compare against, contribute nothing
  // rather than a fabricated delta. For deficit/maintenance goals a negative
  // sum is favorable; for surplus goals a positive sum is favorable.
  const deltaSum = (days ?? [])
    .filter(hasComparablePlan)
    .reduce((sum, d) => sum + deltaFor(d, 'goal'), 0);
  const surplusWeek = baseGoalKcal > 0;
  const favorable = surplusWeek ? deltaSum >= 0 : deltaSum <= 0;

  // The copy follows the week's goal direction: an unfavorable gaining week is
  // under its surplus, an unfavorable cutting week is over its budget.
  let summary: string;
  if (loggedCount === 0) {
    summary = isCurrentWeek
      ? t('today.week_fresh', 'A fresh week. Every logged day counts.')
      : t('day.week_none', 'Nothing was logged that week.');
  } else if (favorable) {
    summary = isCurrentWeek
      ? surplusWeek
        ? t('today.week_ahead_surplus', 'Feeding your surplus right on plan. Keep it rolling.')
        : t('today.week_ahead', 'You are on plan this week. Keep it rolling.')
      : t('day.week_ok', 'That week landed on plan.');
  } else if (surplusWeek) {
    summary = isCurrentWeek
      ? t('today.week_under_surplus', 'A bit under your surplus so far. Your daily target already makes room for it, just keep eating and logging.')
      : t('day.week_under_surplus', 'That week fell a little short of its surplus. The next targets already adjusted.');
  } else {
    summary = isCurrentWeek
      ? t('today.week_adjusts', 'Slightly over so far. Your daily target already absorbs it, just keep logging.')
      : t('day.week_over', 'That week ran slightly over. Your targets already absorbed it.');
  }

  return (
    <Card variant={inset ? 'inset' : 'card'}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[13px] font-bold text-ink-2 uppercase tracking-wide">
          {isCurrentWeek ? t('today.this_week', 'This week') : t('day.that_week', 'That week')}
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
                d.logged
                  ? 'bg-primary text-on-primary'
                  : inset
                    ? 'bg-card text-ink-3'
                    : 'bg-inset text-ink-3',
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
