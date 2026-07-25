import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CalorieHero } from '@/components/today/CalorieHero';
import { WeekStrip } from '@/components/today/WeekStrip';
import { MealsList, ActivitiesList } from '@/components/today/EntryLists';
import { StreakChip } from '@/components/today/StreakChip';
import { ChecklistCard } from '@/components/today/ChecklistCard';
import { TodaySkeleton } from '@/components/today/TodaySkeleton';
import { ErrorState } from '@/components/ui/States';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { useNavigate } from 'react-router';
import { dailyLogService } from '@/services/dailyLogService';
import { queryKeys } from '@/lib/queryKeys';
import { toDateString, parseDate } from '@/utils/format';
import { useCalorieMode } from '@/hooks/useCalorieMode';
import { useDelayedBoolean } from '@/hooks/useDelayedBoolean';

export default function TodayPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = toDateString();
  const { mode } = useCalorieMode();

  const query = useQuery({
    queryKey: queryKeys.dashboard(today),
    queryFn: () => dailyLogService.getDashboard(today).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
  const showSkeleton = useDelayedBoolean(query.isLoading, 300);

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(parseDate(today)),
    [i18n.language, today],
  );

  const onChanged = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(today) });
    queryClient.invalidateQueries({ queryKey: queryKeys.historyAll() });
    queryClient.invalidateQueries({ queryKey: queryKeys.streak() });
  };

  const dash = query.data;
  const hasLoggedToday = (dash?.foodEntries.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-ink leading-tight">
            {t('today.title', 'Today')}
          </h1>
          <p className="text-[13px] text-ink-2 capitalize">{dateLabel}</p>
        </div>
        <StreakChip hasLoggedToday={hasLoggedToday} />
      </header>

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

          <CalorieHero dash={dash} mode={mode} />

          {!hasLoggedToday && <ChecklistCard hasGoal={dash.hasCalorieBudgetEstimate} />}

          <WeekStrip date={today} baseGoalKcal={dash.snapshotDailyBaseGoalKcal} />

          <MealsList date={today} entries={dash.foodEntries} onChanged={onChanged} />
          <ActivitiesList
            date={today}
            entries={dash.activityEntries}
            hasCalorieEstimate={dash.hasCalorieEstimate}
            onChanged={onChanged}
          />
        </>
      )}
    </div>
  );
}
