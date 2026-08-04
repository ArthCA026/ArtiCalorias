import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { CalorieModeTag } from '@/components/ui/CalorieModeTag';
import { WeekDeltaChart } from '@/components/progress/WeekDeltaChart';
import { WeekPickerSheet } from '@/components/progress/WeekPickerSheet';
import { PremiumInsightCard } from '@/components/progress/PremiumInsightCard';
import { StreakCard } from '@/components/progress/StreakCard';
import { ProgressSkeleton } from '@/components/progress/ProgressSkeleton';
import { isLoggedDay } from '@/components/progress/weekMath';
import {
  deltaFor,
  hasComparablePlan,
  isFavorableFor,
  isSurplusGoalDay,
} from '@/utils/calorieMath';
import { historyService } from '@/services/historyService';
import { queryKeys } from '@/lib/queryKeys';
import { addDays, mondayOf, parseDate, toDateString } from '@/utils/format';
import { useCalorieMode } from '@/hooks/useCalorieMode';
import { useDelayedBoolean } from '@/hooks/useDelayedBoolean';
import { usePersistedState } from '@/hooks/usePersistedState';
import { cn } from '@/utils/cn';

/** A stored week is only reused when it is a real, non-future Monday. */
const isValidMonday = (v: string): v is string =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) && mondayOf(v) === v && v <= mondayOf(toDateString());

/**
 * Progress: weekly-first analytics. The week, not the day, is the unit of
 * judgement here; copy stays calm when a week goes sideways so a single
 * off day never snowballs into giving up (no what-the-hell effect).
 */
export default function ProgressPage() {
  const { t, i18n } = useTranslation();
  const { mode } = useCalorieMode();
  const navigate = useNavigate();

  const today = toDateString();
  const currentMonday = mondayOf(today);
  // Remembered across navigation: drilling into a day and coming back, or
  // reloading, keeps the week you were reviewing.
  const [monday, setMonday] = usePersistedState('ac-progress-week', currentMonday, isValidMonday);
  const [pickerOpen, setPickerOpen] = useState(false);
  const sunday = addDays(monday, 6);
  const isCurrentWeek = monday === currentMonday;

  const query = useQuery({
    queryKey: queryKeys.history(monday, sunday),
    queryFn: () => historyService.getDailyRange(monday, sunday).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const showSkeleton = useDelayedBoolean(query.isLoading, 300);
  const days = query.data;

  // ── Formatting helpers ────────────────────────────────────────────────────
  const energy = (kcal: number) => `${Math.round(kcal).toLocaleString(i18n.language)} kcal`;

  /** Explicit sign, Unicode minus (never an em dash), no label. */
  const signedEnergyValue = (kcal: number) => {
    const v = Math.round(kcal);
    if (v === 0) return '0';
    return `${v > 0 ? '+' : '−'}${Math.abs(v).toLocaleString(i18n.language)}`;
  };

  const weekdayLong = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { weekday: 'long' }),
    [i18n.language],
  );

  const rangeLabel = useMemo(() => {
    const sameYear = parseDate(monday).getFullYear() === new Date().getFullYear();
    const dateFormat = new Intl.DateTimeFormat(i18n.language, {
      day: 'numeric',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' as const }),
    });
    return `${dateFormat.format(parseDate(monday))} - ${dateFormat.format(parseDate(sunday))}`;
  }, [monday, sunday, i18n.language]);

  const pagerLabel = isCurrentWeek
    ? t('progress.this_week', 'This week')
    : monday === addDays(currentMonday, -7)
      ? t('progress.last_week', 'Last week')
      : rangeLabel;

  // ── Weekly summary ────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    if (!days || days.length === 0) return null;
    const logged = days.filter(isLoggedDay);
    const loggedCount = logged.length;
    const avgEatenKcal =
      loggedCount > 0
        ? logged.reduce((s, d) => s + d.totalFoodCaloriesKcal, 0) / loggedCount
        : 0;
    // Distance from plan under the active display mode, over the days that
    // actually have a plan to compare against. A row can exist with no food on
    // it, and without weight and height the budget fields come back zeroed;
    // either would contribute a whole day's plan as if it were real. Summing
    // the same days the chart draws keeps this total equal to its bars.
    const deltaSumKcal = days
      .filter(hasComparablePlan)
      .reduce((s, d) => s + deltaFor(d, mode), 0);
    // Week direction follows the dominant goal type across its days.
    const surplusWeek = days.filter(isSurplusGoalDay).length > days.length / 2;
    const favorable = surplusWeek ? deltaSumKcal >= 0 : deltaSumKcal <= 0;
    return { loggedCount, avgEatenKcal, deltaSumKcal, surplusWeek, favorable };
  }, [days, mode]);

  // Weekly thinking beats daily perfection: never guilt, always absorbable.
  // The copy follows the week's goal: on a gaining week, over plan is the win
  // and falling short is the thing a normal week absorbs.
  const weekLine = summary
    ? summary.favorable
      ? summary.surplusWeek
        ? t('progress.week_on_plan_surplus', 'Feeding your surplus on plan. Nice and steady.')
        : t('progress.week_on_plan', 'On plan this week. Nice and steady.')
      : summary.surplusWeek
        ? t('progress.week_under_surplus', 'A bit under your surplus. Nothing a normal week cannot absorb.')
        : summary.deltaSumKcal > 0
          ? t('progress.week_over_plan', 'A bit over plan. Nothing a normal week cannot absorb.')
          : t('progress.week_under_plan', 'A bit under plan. Nothing a normal week cannot absorb.')
    : '';

  // All seven days of the week, Monday to Sunday, with their log when one exists.
  const dayRows = useMemo(() => {
    const byDate = new Map((days ?? []).map((d) => [d.logDate, d]));
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i);
      return { date, log: byDate.get(date) ?? null };
    });
  }, [days, monday]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[22px] font-extrabold text-ink leading-tight">
          {t('progress.title', 'Progress')}
        </h1>
        <p className="text-[13px] text-ink-2">{rangeLabel}</p>
      </header>

      <Card padded={false} className="flex items-center justify-between px-1.5 py-1.5">
        <IconButton
          icon="chevronLeft"
          label={t('progress.prev_week', 'Previous week')}
          onClick={() => setMonday(addDays(monday, -7))}
        />
        {/* The label is the fast path: one tap opens the week jumper instead
            of paging arrow by arrow to a months-old week. */}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-label={t('progress.week_picker_aria', 'Shown week: {{week}}. Tap to jump to another week.', { week: pagerLabel })}
          className="pressable flex items-center gap-1 rounded-full active:bg-press px-3 py-1.5"
        >
          <span className="text-[15px] font-bold text-ink">{pagerLabel}</span>
          <Icon name="chevronDown" size={15} className="text-ink-3" />
        </button>
        <IconButton
          icon="chevronRight"
          label={t('progress.next_week', 'Next week')}
          disabled={isCurrentWeek}
          className="disabled:opacity-35 disabled:pointer-events-none"
          onClick={() => setMonday(addDays(monday, 7))}
        />
      </Card>

      <WeekPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={monday}
        onPick={setMonday}
      />

      {query.isError && (
        <ErrorState
          title={t('progress.load_error_title', 'Could not load your week')}
          body={t('progress.load_error_body', 'Check your internet connection and try again. Your logged data is safe.')}
          retryLabel={t('progress.retry', 'Try again')}
          onRetry={() => query.refetch()}
        />
      )}

      {!days && !query.isError && showSkeleton && <ProgressSkeleton />}

      {/* Current empty weeks skip this: the ghost rows below already teach what to do. */}
      {days && days.length === 0 && !isCurrentWeek && (
        <Card padded={false}>
          <EmptyState
            icon="chart"
            title={t('progress.empty_title', 'Nothing logged this week yet')}
            body={t('progress.empty_body', 'Days you log appear here, one dot at a time.')}
          />
        </Card>
      )}

      {days && summary && (
        <>
          {/* The verdict leads: one big signed number instead of three equal
              tiles, so the week reads as an outcome, not a spreadsheet. The
              counters that used to compete with it become support chips. */}
          <Card>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-bold text-ink-2 uppercase tracking-wide">
                {t('progress.summary_title', 'Your week')}
              </p>
              <CalorieModeTag />
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span
                className={cn(
                  'text-[30px] font-extrabold tabular-nums leading-none',
                  summary.favorable ? 'text-success' : 'text-warning',
                )}
              >
                {signedEnergyValue(summary.deltaSumKcal)}
              </span>
              <span className="text-[13px] font-semibold text-ink-2">
                {t('progress.hero_vs_plan', 'kcal vs plan')}
              </span>
            </div>
            <p className="mt-2 text-[13px] text-ink-2 leading-relaxed">{weekLine}</p>
            <div className="mt-3.5 grid grid-cols-2 gap-2">
              <div className="rounded-card bg-inset px-3 py-2.5">
                <p className="text-[11px] font-semibold text-ink-3">
                  {t('progress.days_logged', 'Days logged')}
                </p>
                <p className="mt-0.5 text-[15px] font-extrabold text-ink tabular-nums">
                  {t('progress.days_of_week', '{{n}} of 7', { n: summary.loggedCount })}
                </p>
              </div>
              <div className="rounded-card bg-inset px-3 py-2.5">
                <p className="text-[11px] font-semibold text-ink-3">
                  {t('progress.avg_eaten_label', 'Avg eaten per day')}
                </p>
                <p className="mt-0.5 text-[15px] font-extrabold text-ink tabular-nums">
                  {energy(summary.avgEatenKcal)}
                </p>
              </div>
            </div>
            <p className="mt-2.5 text-[12px] text-ink-3">
              {t('progress.week_motto', 'Weekly thinking beats daily perfection.')}
            </p>
          </Card>

          <PremiumInsightCard monday={monday} days={days} mode={mode} />

          <WeekDeltaChart monday={monday} days={days} mode={mode} />
        </>
      )}

      {days && (
        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
            <div>
              <p className="text-[13px] font-bold text-ink-2 uppercase tracking-wide">
                {t('progress.days_title', 'Days')}
              </p>
              <p className="mt-0.5 text-[12px] text-ink-3">
                {t('progress.days_subtitle', 'Tap any day to open and edit it')}
              </p>
            </div>
            <CalorieModeTag />
          </div>
          {dayRows.map(({ date, log }, i) => {
            const border = i > 0 && 'border-t border-hairline/60';

            // Logged day: drills into the editable day view. Each row carries
            // its own words ("kcal eaten", the signed pill), so the old
            // floating column-header row is gone for good.
            if (log) {
              const comparable = hasComparablePlan(log);
              const eatenLabel = t('progress.eaten_meta', '{{kcal}} kcal eaten', {
                kcal: Math.round(log.totalFoodCaloriesKcal).toLocaleString(i18n.language),
              });
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => navigate(`/day/${log.logDate}`)}
                  aria-label={
                    comparable
                      ? t('progress.day_row_aria', '{{day}}: {{eaten}} kcal eaten, {{delta}} kcal from plan.', {
                          day: weekdayLong.format(parseDate(date)),
                          eaten: Math.round(log.totalFoodCaloriesKcal).toLocaleString(i18n.language),
                          delta: signedEnergyValue(deltaFor(log, mode)),
                        })
                      : t('progress.day_row_aria_no_plan', '{{day}}: {{eaten}} kcal eaten.', {
                          day: weekdayLong.format(parseDate(date)),
                          eaten: Math.round(log.totalFoodCaloriesKcal).toLocaleString(i18n.language),
                        })
                  }
                  className={cn(
                    'pressable w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-press',
                    border,
                  )}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold text-ink capitalize truncate">
                      {weekdayLong.format(parseDate(date))}
                    </span>
                    <span className="block text-[12px] text-ink-2 tabular-nums mt-0.5">
                      {eatenLabel}
                    </span>
                  </span>
                  {comparable ? (
                    <span
                      className={cn(
                        'min-w-13 text-center rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums',
                        isFavorableFor(log, mode)
                          ? 'bg-success-soft text-success'
                          : 'bg-warning-soft text-warning',
                      )}
                    >
                      {signedEnergyValue(deltaFor(log, mode))}
                    </span>
                  ) : (
                    // No budget to compare against: show nothing rather than a
                    // number invented from zeroed fields.
                    <span className="min-w-13 text-center text-[12px] font-bold text-ink-3">–</span>
                  )}
                  <Icon name="chevronRight" size={16} className="text-ink-3 shrink-0" />
                </button>
              );
            }

            // Future day: named but inert; future days can never be added.
            if (date > today) {
              return (
                <div key={date} className={cn('flex items-center px-4 h-13 opacity-40', border)}>
                  <span className="flex-1 text-[15px] font-semibold text-ink capitalize truncate">
                    {weekdayLong.format(parseDate(date))}
                  </span>
                </div>
              );
            }

            // Ghost row: today goes to the Today screen, missed days to the day view.
            const isToday = date === today;
            return (
              <button
                key={date}
                type="button"
                onClick={() => navigate(isToday ? '/today' : `/day/${date}`)}
                className={cn(
                  'pressable w-full flex items-center gap-2.5 px-4 h-13 text-left active:bg-press',
                  border,
                )}
              >
                <span className="flex-1 text-[15px] font-semibold text-ink-3 capitalize truncate">
                  {isToday ? t('progress.today_row', 'Today') : weekdayLong.format(parseDate(date))}
                </span>
                <span className="text-[13px] text-ink-3">
                  {t('progress.add_missed_day', 'Add this day')}
                </span>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-inset">
                  <Icon name="plus" size={14} className="text-ink-2" />
                </span>
              </button>
            );
          })}
        </Card>
      )}

      {days && <StreakCard />}
    </div>
  );
}
