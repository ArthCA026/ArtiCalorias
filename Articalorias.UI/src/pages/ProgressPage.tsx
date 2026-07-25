import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { ConfirmSheet } from '@/components/ui/ActionSheet';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { WeekDeltaChart } from '@/components/progress/WeekDeltaChart';
import { PremiumInsightCard } from '@/components/progress/PremiumInsightCard';
import { StreakCard } from '@/components/progress/StreakCard';
import { ProgressSkeleton } from '@/components/progress/ProgressSkeleton';
import {
  isFavorableDelta,
  isLoggedDay,
  isSurplusGoalDay,
} from '@/components/progress/weekMath';
import { historyService } from '@/services/historyService';
import { dailyLogService } from '@/services/dailyLogService';
import { queryKeys } from '@/lib/queryKeys';
import { addDays, fmt, mondayOf, parseDate, toDateString } from '@/utils/format';
import { energyLabel, kcalToDisplay } from '@/utils/units';
import { useUnits } from '@/hooks/useUnits';
import { useDelayedBoolean } from '@/hooks/useDelayedBoolean';
import { extractApiError } from '@/utils/apiError';
import { cn } from '@/utils/cn';

/**
 * Progress: weekly-first analytics. The week, not the day, is the unit of
 * judgement here; copy stays calm when a week goes sideways so a single
 * off day never snowballs into giving up (no what-the-hell effect).
 */
export default function ProgressPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { energyUnit } = useUnits();
  const queryClient = useQueryClient();

  const today = toDateString();
  const currentMonday = mondayOf(today);
  const [monday, setMonday] = useState(currentMonday);
  const sunday = addDays(monday, 6);
  const isCurrentWeek = monday === currentMonday;

  const query = useQuery({
    queryKey: queryKeys.history(monday, sunday),
    queryFn: () => historyService.getDailyRange(monday, sunday).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const showSkeleton = useDelayedBoolean(query.isLoading, 300);
  const days = query.data;

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const selectedDay = days?.find((d) => d.logDate === selectedDate) ?? null;

  const deleteMutation = useMutation({
    mutationFn: (date: string) => dailyLogService.deleteDay(date),
    onSuccess: () => {
      toast('success', t('progress.day_deleted', 'Day deleted'));
      queryClient.invalidateQueries({ queryKey: queryKeys.historyAll() });
      setConfirmOpen(false);
      setSelectedDate(null);
    },
    onError: (err) => {
      toast('error', extractApiError(err, t('progress.delete_error', 'Could not delete the day. Try again.')));
    },
  });

  // ── Formatting helpers ────────────────────────────────────────────────────
  const energy = (kcal: number) =>
    `${Math.round(kcalToDisplay(kcal, energyUnit)).toLocaleString(i18n.language)} ${energyLabel(energyUnit)}`;

  /** Explicit sign, Unicode minus (never an em dash), display units, no label. */
  const signedEnergyValue = (kcal: number) => {
    const v = Math.round(kcalToDisplay(kcal, energyUnit));
    if (v === 0) return '0';
    return `${v > 0 ? '+' : '−'}${Math.abs(v).toLocaleString(i18n.language)}`;
  };

  const weekdayLong = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { weekday: 'long' }),
    [i18n.language],
  );
  const dayTitleFormat = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }),
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
    const deltaSumKcal = days.reduce((s, d) => s + d.dailyGoalDeltaKcal, 0);
    // Week direction follows the dominant goal type across its days.
    const surplusWeek = days.filter(isSurplusGoalDay).length > days.length / 2;
    const favorable = surplusWeek ? deltaSumKcal >= 0 : deltaSumKcal <= 0;
    return { loggedCount, avgEatenKcal, deltaSumKcal, favorable };
  }, [days]);

  // Weekly thinking beats daily perfection: never guilt, always absorbable.
  const weekLine = summary
    ? summary.favorable
      ? t('progress.week_on_plan', 'On plan this week. Nice and steady.')
      : summary.deltaSumKcal > 0
        ? t('progress.week_over_plan', 'A bit over plan. Nothing a normal week cannot absorb.')
        : t('progress.week_under_plan', 'A bit under plan. Nothing a normal week cannot absorb.')
    : '';

  const orderedDays = useMemo(
    () => (days ? [...days].sort((a, b) => (a.logDate < b.logDate ? -1 : 1)) : []),
    [days],
  );

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
        <p className="text-[15px] font-bold text-ink">{pagerLabel}</p>
        <IconButton
          icon="chevronRight"
          label={t('progress.next_week', 'Next week')}
          disabled={isCurrentWeek}
          className="disabled:opacity-35 disabled:pointer-events-none"
          onClick={() => setMonday(addDays(monday, 7))}
        />
      </Card>

      {query.isError && (
        <ErrorState
          title={t('progress.load_error_title', 'Could not load your week')}
          body={t('progress.load_error_body', 'Check your internet connection and try again. Your logged data is safe.')}
          retryLabel={t('progress.retry', 'Try again')}
          onRetry={() => query.refetch()}
        />
      )}

      {!days && !query.isError && showSkeleton && <ProgressSkeleton />}

      {days && days.length === 0 && (
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
          <Card>
            <p className="text-[13px] font-bold text-ink-2 uppercase tracking-wide">
              {t('progress.summary_title', 'Your week')}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-card bg-inset px-2 py-2.5 text-center">
                <p className="text-[17px] font-extrabold text-ink tabular-nums">
                  {t('progress.days_of_week', '{{n}} of 7', { n: summary.loggedCount })}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-ink-3">
                  {t('progress.days_logged', 'Days logged')}
                </p>
              </div>
              <div className="rounded-card bg-inset px-2 py-2.5 text-center">
                <p className="text-[17px] font-extrabold text-ink tabular-nums">
                  {Math.round(kcalToDisplay(summary.avgEatenKcal, energyUnit)).toLocaleString(i18n.language)}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-ink-3">
                  {t('progress.avg_eaten', 'Avg {{unit}} eaten', { unit: energyLabel(energyUnit) })}
                </p>
              </div>
              <div className="rounded-card bg-inset px-2 py-2.5 text-center">
                <p
                  className={cn(
                    'text-[17px] font-extrabold tabular-nums',
                    summary.favorable ? 'text-success' : 'text-warning',
                  )}
                >
                  {signedEnergyValue(summary.deltaSumKcal)}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-ink-3">
                  {t('progress.vs_plan', 'vs plan')}
                </p>
              </div>
            </div>
            <p className="mt-3.5 text-[13px] text-ink-2 leading-relaxed">{weekLine}</p>
            <p className="mt-1 text-[12px] text-ink-3">
              {t('progress.week_motto', 'Weekly thinking beats daily perfection.')}
            </p>
          </Card>

          <PremiumInsightCard monday={monday} days={days} />

          <WeekDeltaChart monday={monday} days={days} />

          {orderedDays.length > 0 && (
            <Card padded={false} className="overflow-hidden">
              <p className="px-4 pt-4 pb-1.5 text-[13px] font-bold text-ink-2 uppercase tracking-wide">
                {t('progress.day_list_title', 'Logged days')}
              </p>
              {orderedDays.map((d, i) => (
                <button
                  key={d.logDate}
                  type="button"
                  onClick={() => setSelectedDate(d.logDate)}
                  className={cn(
                    'pressable w-full flex items-center gap-2.5 px-4 h-13 text-left active:bg-press',
                    i > 0 && 'border-t border-hairline/60',
                  )}
                >
                  <span className="flex-1 text-[15px] font-semibold text-ink capitalize truncate">
                    {weekdayLong.format(parseDate(d.logDate))}
                  </span>
                  <span className="text-[13px] text-ink-2 tabular-nums">
                    {energy(d.totalFoodCaloriesKcal)}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums',
                      isFavorableDelta(d)
                        ? 'bg-success-soft text-success'
                        : 'bg-warning-soft text-warning',
                    )}
                  >
                    {signedEnergyValue(d.dailyGoalDeltaKcal)}
                  </span>
                  <Icon name="chevronRight" size={16} className="text-ink-3 shrink-0" />
                </button>
              ))}
            </Card>
          )}
        </>
      )}

      {days && <StreakCard />}

      <Sheet
        open={selectedDay !== null}
        onClose={() => setSelectedDate(null)}
        title={
          selectedDay ? (
            <span className="capitalize">{dayTitleFormat.format(parseDate(selectedDay.logDate))}</span>
          ) : undefined
        }
      >
        {selectedDay && (
          <div className="space-y-2 pt-1">
            <div className="rounded-card bg-inset px-4 py-3 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink-2">
                {t('progress.day_eaten', 'Eaten')}
              </span>
              <span className="text-[15px] font-bold text-ink tabular-nums">
                {energy(selectedDay.totalFoodCaloriesKcal)}
              </span>
            </div>
            <div className="rounded-card bg-inset px-4 py-3 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink-2">
                {t('progress.day_burned', 'Burned')}
              </span>
              <span className="text-[15px] font-bold text-ink tabular-nums">
                {energy(selectedDay.totalDailyExpenditureKcal)}
              </span>
            </div>
            <div className="rounded-card bg-inset px-4 py-3 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink-2">
                {t('progress.day_protein', 'Protein')}
              </span>
              <span className="text-[15px] font-bold text-ink tabular-nums">
                {selectedDay.snapshotProteinGoalGrams > 0
                  ? t('progress.protein_of_goal', '{{eaten}} g of {{goal}} g', {
                      eaten: fmt(selectedDay.totalProteinGrams),
                      goal: fmt(selectedDay.snapshotProteinGoalGrams),
                    })
                  : t('progress.protein_grams', '{{eaten}} g', {
                      eaten: fmt(selectedDay.totalProteinGrams),
                    })}
              </span>
            </div>
            <div className="rounded-card bg-inset px-4 py-3 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-ink-2">
                {t('progress.vs_plan', 'vs plan')}
              </span>
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-[13px] font-bold tabular-nums',
                  isFavorableDelta(selectedDay)
                    ? 'bg-success-soft text-success'
                    : 'bg-warning-soft text-warning',
                )}
              >
                {`${signedEnergyValue(selectedDay.dailyGoalDeltaKcal)} ${energyLabel(energyUnit)}`}
              </span>
            </div>

            {selectedDay.logDate !== today && (
              <Button
                variant="danger"
                size="lg"
                icon="trash"
                fullWidth
                className="!mt-5"
                onClick={() => setConfirmOpen(true)}
              >
                {t('progress.delete_day', 'Delete this day')}
              </Button>
            )}
          </div>
        )}
      </Sheet>

      <ConfirmSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('progress.delete_confirm_title', 'Delete this day?')}
        body={t('progress.delete_confirm_body', 'This permanently removes the day and its entries.')}
        confirmLabel={t('progress.delete_confirm_action', 'Delete day')}
        cancelLabel={t('progress.cancel', 'Cancel')}
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (selectedDate) deleteMutation.mutate(selectedDate);
        }}
      />
    </div>
  );
}
