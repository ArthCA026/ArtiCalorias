import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CalorieHero } from '@/components/today/CalorieHero';
import { DayDetailsSheet } from '@/components/today/DayDetailsSheet';
import { MealsList, ActivitiesList } from '@/components/today/EntryLists';
import { ChecklistCard } from '@/components/today/ChecklistCard';
import { WaterCard } from '@/components/today/WaterCard';
import { AlcoholCard } from '@/components/today/AlcoholCard';
import { TodaySkeleton } from '@/components/today/TodaySkeleton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ActionSheet } from '@/components/ui/ActionSheet';
import { ErrorState } from '@/components/ui/States';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/Button';
import { Fab } from '@/components/ui/Fab';
import { useLogSheet } from '@/components/log/LogSheetContext';
import { dailyLogService } from '@/services/dailyLogService';
import { queryKeys, invalidateDayData } from '@/lib/queryKeys';
import { useCalorieMode } from '@/hooks/useCalorieMode';
import { useDelayedBoolean } from '@/hooks/useDelayedBoolean';
import { usePersistedState } from '@/hooks/usePersistedState';

type ListTab = 'meals' | 'activities';

const isListTab = (v: string): v is ListTab => v === 'meals' || v === 'activities';

/**
 * How the day's entries are ordered. A lasting preference (localStorage, not
 * per-session): people read their log one habitual way.
 *  - newest: what you just logged lands on top, immediate feedback (default);
 *  - oldest: chronological, the day reads like a diary (the old behavior);
 *  - kcal:   heaviest hitters first, "where did my calories go?".
 * SortOrder is the server's insertion sequence, so it doubles as a timestamp.
 */
type DaySort = 'newest' | 'oldest' | 'kcal';
const SORT_KEY = 'ac-day-sort';

const loadSort = (): DaySort => {
  const v = localStorage.getItem(SORT_KEY);
  return v === 'oldest' || v === 'kcal' ? v : 'newest';
};

interface DayViewProps {
  /** yyyy-MM-dd, today or a past day */
  date: string;
  isToday: boolean;
}

/**
 * The full editable day: hero ring, meals/activities tabs and the Log FAB.
 * Used by the Today tab and by /day/:date for past days, so editing an
 * old day feels exactly like editing today.
 */
export function DayView({ date, isToday }: DayViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { mode } = useCalorieMode();
  const { openLog } = useLogSheet();

  // Remembered across navigation: coming back to a day view reopens the list
  // (meals or activities) that was in front when you left.
  const [listTab, setListTab] = usePersistedState<ListTab>('ac-tab-day', 'meals', isListTab);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sort, setSort] = useState<DaySort>(loadSort);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);

  const changeSort = (s: DaySort) => {
    localStorage.setItem(SORT_KEY, s);
    setSort(s);
    setSortSheetOpen(false);
  };

  const query = useQuery({
    queryKey: queryKeys.dashboard(date),
    queryFn: () => dailyLogService.getDashboard(date).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const showSkeleton = useDelayedBoolean(query.isLoading, 300);
  const dash = query.data;

  const onChanged = () => invalidateDayData(queryClient);

  const sortedMeals = useMemo(() => {
    const list = [...(dash?.foodEntries ?? [])];
    if (sort === 'oldest') return list.sort((a, b) => a.sortOrder - b.sortOrder);
    if (sort === 'kcal')
      return list.sort((a, b) => b.caloriesKcal - a.caloriesKcal || b.sortOrder - a.sortOrder);
    return list.sort((a, b) => b.sortOrder - a.sortOrder);
  }, [dash?.foodEntries, sort]);

  const sortedActivities = useMemo(() => {
    const list = [...(dash?.activityEntries ?? [])];
    if (sort === 'oldest') return list.sort((a, b) => a.sortOrder - b.sortOrder);
    if (sort === 'kcal')
      return list.sort(
        (a, b) => b.calculatedCaloriesKcal - a.calculatedCaloriesKcal || b.sortOrder - a.sortOrder,
      );
    return list.sort((a, b) => b.sortOrder - a.sortOrder);
  }, [dash?.activityEntries, sort]);

  const sortLabel =
    sort === 'oldest'
      ? t('sort.oldest', 'Oldest first')
      : sort === 'kcal'
        ? t('sort.kcal', 'Highest calories')
        : t('sort.newest', 'Newest first');

  // Extra tracked macros for the meal-row strips, from the day's own frozen
  // targets: a past day shows the columns it was lived under.
  const extraMacros = useMemo(
    () =>
      (dash?.macroTargets ?? [])
        .map((m) => m.macroKey)
        .filter((k) => k === 'alcohol' || k === 'sugar' || k === 'water'),
    [dash?.macroTargets],
  );

  return (
    <div className="space-y-4">
      {query.isError && (
        <ErrorState
          title={t('today.load_error_title', 'Could not load your day')}
          body={t('today.load_error_body', 'Check your internet connection and try again. Your logged data is safe.')}
          retryLabel={t('common.retry', 'Retry')}
          onRetry={() => query.refetch()}
        />
      )}

      {!dash && !query.isError && showSkeleton && <TodaySkeleton />}

      {dash && (
        <>
          {!dash.hasCalorieBudgetEstimate && (
            <Card variant="soft" className="!p-0">
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="pressable w-full flex items-center gap-3 p-4 text-left"
              >
                <span className="w-9 h-9 rounded-xl bg-card text-primary-soft-ink flex items-center justify-center shrink-0">
                  <Icon name="target" size={18} />
                </span>
                <span className="flex-1">
                  <span className="block text-[14px] font-bold text-primary-soft-ink">
                    {t('today.complete_profile_title', 'Unlock your calorie budget')}
                  </span>
                  <span className="block text-[13px] text-primary-soft-ink/80 mt-0.5">
                    {t('today.complete_profile_body', 'Add your weight and height, it takes 30 seconds')}
                  </span>
                </span>
                <Icon name="chevronRight" size={18} className="text-primary-soft-ink shrink-0" />
              </button>
            </Card>
          )}

          <div data-tour="ring">
            <CalorieHero
              dash={dash}
              mode={mode}
              isToday={isToday}
              onOpenDetails={() => setDetailsOpen(true)}
            />
          </div>

          {/* Getting-started checklist: only for accounts that have never
              logged anything, ever. A day that merely STARTS empty (every
              morning does) must not resurrect it for veterans. It also makes
              no sense on a deliberate fast: "log your first meal" would
              contradict the fast. */}
          {isToday && !dash.hasEverLoggedFood && dash.foodEntries.length === 0 && !dash.isFastingDay && (
            <ChecklistCard hasGoal={dash.hasCalorieBudgetEstimate} />
          )}

          <WaterCard date={date} log={dash} />

          <AlcoholCard date={date} log={dash} />

          <div data-tour="lists" className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <SegmentedControl<ListTab>
                aria-label={t('today.list_switch', 'Meals or activities')}
                options={[
                  {
                    value: 'meals',
                    label: `${t('today.meals', 'Meals')} (${dash.foodEntries.length})`,
                    icon: 'meal',
                  },
                  {
                    value: 'activities',
                    label: `${t('today.activities', 'Activities')} (${dash.activityEntries.length})`,
                    icon: 'activity',
                  },
                ]}
                value={listTab}
                onChange={setListTab}
              />
            </div>
            <IconButton
              icon="arrowUpDown"
              label={t('sort.button_aria', 'Change list order. Current: {{order}}', { order: sortLabel })}
              onClick={() => setSortSheetOpen(true)}
            />
          </div>

          {listTab === 'meals' ? (
            <MealsList
              date={date}
              entries={sortedMeals}
              extraMacros={extraMacros}
              isToday={isToday}
              isFastingDay={dash.isFastingDay}
              onChanged={onChanged}
            />
          ) : (
            <ActivitiesList
              date={date}
              entries={sortedActivities}
              hasCalorieEstimate={dash.hasCalorieEstimate}
              isToday={isToday}
              onChanged={onChanged}
            />
          )}

          <ActionSheet
            open={sortSheetOpen}
            onClose={() => setSortSheetOpen(false)}
            title={t('sort.sheet_title', 'Order the lists by')}
            actions={[
              {
                icon: sort === 'newest' ? 'check' : 'clock',
                label: t('sort.newest', 'Newest first'),
                onSelect: () => changeSort('newest'),
              },
              {
                icon: sort === 'oldest' ? 'check' : 'calendar',
                label: t('sort.oldest', 'Oldest first'),
                onSelect: () => changeSort('oldest'),
              },
              {
                icon: sort === 'kcal' ? 'check' : 'flame',
                label: t('sort.kcal', 'Highest calories'),
                onSelect: () => changeSort('kcal'),
              },
            ]}
          />

          <DayDetailsSheet
            open={detailsOpen}
            onClose={() => setDetailsOpen(false)}
            dash={dash}
            mode={mode}
            date={date}
            isToday={isToday}
          />
        </>
      )}

      <Fab
        label={t('log.fab', 'Log')}
        dataTour="log"
        onClick={() => openLog(listTab === 'activities' ? 'activity' : 'meal', date)}
      />
    </div>
  );
}
