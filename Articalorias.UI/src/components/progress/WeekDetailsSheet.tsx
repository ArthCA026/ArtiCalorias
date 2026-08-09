import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { Icon } from '@/components/ui/Icon';
import { isLoggedDay } from '@/components/progress/weekMath';
import { deltaFor, hasComparablePlan, isSurplusGoalDay } from '@/utils/calorieMath';
import { useUnits } from '@/hooks/useUnits';
import { toDateString } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { DailyLogResponse } from '@/types';

const KCAL_PER_KG = 7700;
const LBS_PER_KG = 2.20462;

interface WeekDetailsSheetProps {
  open: boolean;
  onClose: () => void;
  days: DailyLogResponse[];
  /** The running week gets "so far" tense; a past week is a closed record */
  isCurrentWeek: boolean;
}

/**
 * The numbers behind the week, one tap away, mirroring the Day details sheet.
 *
 * Its centerpiece is the estimated weight change: the week's summed energy
 * balance converted through 7,700 kcal per kg. Only completed, fully budgeted
 * days count. Today is deliberately excluded while it is still running: at
 * breakfast time a day always looks like a huge deficit, and a number that
 * swings all day teaches distrust instead of insight.
 */
export function WeekDetailsSheet({ open, onClose, days, isCurrentWeek }: WeekDetailsSheetProps) {
  const { t, i18n } = useTranslation();
  const { weightUnit } = useUnits();

  const stats = useMemo(() => {
    const today = toDateString();
    // Completed = logged, with a real calorie budget, and (this week) already over.
    const completed = days.filter(
      (d) => isLoggedDay(d) && d.hasCalorieBudgetEstimate && (!isCurrentWeek || d.logDate < today),
    );
    const netSumKcal = completed.reduce(
      (s, d) => s + (d.totalFoodCaloriesKcal - d.totalDailyExpenditureKcal),
      0,
    );
    const kgSoFar = netSumKcal / KCAL_PER_KG;
    // The Excel-style weekly figure (avg daily balance × 7 / 7700), usable on
    // any weekday because it extrapolates from the completed days' average.
    const kgWeekPace = completed.length > 0 ? (netSumKcal / completed.length) * 7 / KCAL_PER_KG : 0;
    const avgEaten =
      completed.length > 0
        ? completed.reduce((s, d) => s + d.totalFoodCaloriesKcal, 0) / completed.length
        : 0;
    const avgBurned =
      completed.length > 0
        ? completed.reduce((s, d) => s + d.totalDailyExpenditureKcal, 0) / completed.length
        : 0;
    // Distance from the fixed daily plan over the same completed days, so every
    // number inside this sheet describes the same set of days.
    const vsPlanKcal = completed
      .filter(hasComparablePlan)
      .reduce((s, d) => s + deltaFor(d, 'goal'), 0);
    const surplusWeek = days.filter(isSurplusGoalDay).length > days.length / 2;
    return { completed: completed.length, netSumKcal, kgSoFar, kgWeekPace, avgEaten, avgBurned, vsPlanKcal, surplusWeek };
  }, [days, isCurrentWeek]);

  const energy = (kcal: number) => `${Math.round(kcal).toLocaleString(i18n.language)} kcal`;
  const signedEnergy = (kcal: number) => {
    const v = Math.round(kcal);
    if (v === 0) return '0 kcal';
    return `${v > 0 ? '+' : '−'}${Math.abs(v).toLocaleString(i18n.language)} kcal`;
  };

  /** "−0.21 kg" / "+0.4 lbs": explicit sign, device weight unit, 2 decimals. */
  const weightChange = (kg: number) => {
    const value = weightUnit === 'lbs' ? kg * LBS_PER_KG : kg;
    const rounded = Math.round(value * 100) / 100;
    if (rounded === 0) return `0 ${weightUnit}`;
    return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(2)} ${weightUnit}`;
  };

  const losing = stats.kgSoFar < 0;
  // On a cutting week losing reads as success; on a gaining week, gaining does.
  const favorable = stats.surplusWeek ? stats.kgSoFar >= 0 : stats.kgSoFar <= 0;

  const heroLabel = losing
    ? isCurrentWeek
      ? t('progress.weight_lost_so_far', 'estimated weight lost so far')
      : t('progress.weight_lost_week', 'estimated weight lost that week')
    : isCurrentWeek
      ? t('progress.weight_gained_so_far', 'estimated weight gained so far')
      : t('progress.weight_gained_week', 'estimated weight gained that week');

  return (
    <Sheet open={open} onClose={onClose} title={t('progress.week_details_title', 'Week details')}>
      <div className="space-y-4">
        {stats.completed === 0 ? (
          <div className="rounded-card bg-inset px-4 py-6 text-center">
            <span className="inline-flex text-ink-3">
              <Icon name="scale" size={26} />
            </span>
            <p className="mt-2 text-[14px] font-bold text-ink">
              {t('progress.week_details_empty_title', 'No finished days yet')}
            </p>
            <p className="mt-1 text-[13px] text-ink-2 leading-relaxed">
              {isCurrentWeek
                ? t('progress.week_details_empty_body', 'Your weight estimate appears after your first fully logged day. Today counts once it ends.')
                : t('progress.week_details_empty_past', 'That week has no days with enough data to estimate a weight change.')}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-card bg-inset px-4 py-5 text-center">
              <span className={cn('inline-flex', favorable ? 'text-success' : 'text-warning')}>
                <Icon name={losing ? 'trendingDown' : 'trendingUp'} size={22} />
              </span>
              <p
                className={cn(
                  'mt-1 text-[30px] font-extrabold tabular-nums leading-none',
                  favorable ? 'text-success' : 'text-warning',
                )}
              >
                {weightChange(stats.kgSoFar)}
              </p>
              <p className="mt-1.5 text-[13px] font-semibold text-ink-2">{heroLabel}</p>
              {isCurrentWeek && stats.completed < 7 && (
                <p className="mt-2 text-[12px] text-ink-3">
                  {t('progress.week_pace', 'On pace for {{kg}} by the end of the week', {
                    kg: weightChange(stats.kgWeekPace),
                  })}
                </p>
              )}
            </div>

            <div className="rounded-card bg-inset px-4 py-1">
              <div className="flex items-center justify-between h-11">
                <span className="text-[14px] font-semibold text-ink-2">
                  {t('progress.week_days_counted', 'Finished days counted')}
                </span>
                <span className="text-[15px] font-bold text-ink tabular-nums">
                  {t('progress.days_of_week', '{{n}} of 7', { n: stats.completed })}
                </span>
              </div>
              <div className="flex items-center justify-between h-11 border-t border-hairline/60">
                <span className="text-[14px] font-semibold text-ink-2">
                  {t('progress.week_avg_eaten', 'Avg eaten per day')}
                </span>
                <span className="text-[15px] font-bold text-ink tabular-nums">
                  {energy(stats.avgEaten)}
                </span>
              </div>
              <div className="flex items-center justify-between h-11 border-t border-hairline/60">
                <span className="text-[14px] font-semibold text-ink-2">
                  {t('progress.week_avg_burned', 'Avg burned per day')}
                </span>
                <span className="text-[15px] font-bold text-ink tabular-nums">
                  {energy(stats.avgBurned)}
                </span>
              </div>
              <div className="flex items-center justify-between h-12 border-t-2 border-hairline">
                <span className="text-[14px] font-bold text-ink">
                  {t('progress.week_vs_plan_row', 'Vs daily goal, combined')}
                </span>
                <span className="text-[17px] font-extrabold text-ink tabular-nums">
                  {signedEnergy(stats.vsPlanKcal)}
                </span>
              </div>
            </div>
          </>
        )}

        <p className="flex items-start gap-2 text-[12px] text-ink-3 leading-relaxed">
          <Icon name="info" size={14} className="shrink-0 mt-0.5" />
          {t(
            'progress.week_details_disclaimer',
            'An estimate from your calorie balance (about 7,700 kcal per kg). Scale weight also moves with water and timing, so trust the trend over any single number.',
          )}
        </p>
      </div>
    </Sheet>
  );
}
