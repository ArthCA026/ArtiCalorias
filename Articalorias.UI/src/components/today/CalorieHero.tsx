import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { ProgressRing, ProgressBar } from '@/components/ui/Progress';
import { Icon } from '@/components/ui/Icon';
import { CalorieModeTag } from '@/components/ui/CalorieModeTag';
import { useUnits } from '@/hooks/useUnits';
import { kcalToDisplay, energyLabel } from '@/utils/units';
import { budgetFor } from '@/utils/calorieMath';
import { cn } from '@/utils/cn';
import type { CalorieMode } from '@/hooks/useCalorieMode';
import type { DailyDashboardResponse } from '@/types';

interface CalorieHeroProps {
  dash: DailyDashboardResponse;
  mode: CalorieMode;
  /** Today gets present tense and nudges; a past day reads as a closed record */
  isToday: boolean;
  /** Opens the day details sheet (stats, totals, week) */
  onOpenDetails: () => void;
}

/**
 * Compact day centerpiece: ring, status line and protein bar.
 * Deliberately short so the meal list is visible without scrolling;
 * the numbers behind it live in the details sheet, one tap away.
 */
export function CalorieHero({ dash, mode, isToday, onOpenDetails }: CalorieHeroProps) {
  const { t } = useTranslation();
  const { energyUnit } = useUnits();

  const eaten = dash.totalFoodCaloriesKcal;
  const budget = Math.max(budgetFor(dash, mode), 1);
  const remaining = budget - eaten;
  const progress = eaten / budget;
  const isSurplusGoal = dash.snapshotDailyBaseGoalKcal > 0;
  const over = remaining < 0;
  const nearGoal = !over && progress >= 0.75 && remaining > 0;

  const e = (kcal: number) => Math.round(kcalToDisplay(Math.abs(kcal), energyUnit)).toLocaleString();
  const unit = energyLabel(energyUnit);

  const meaningfullyOver = over && Math.abs(remaining) > budget * 0.05;
  const ringColor = !isSurplusGoal && meaningfullyOver ? 'var(--t-warning)' : undefined;

  // A past day is a closed record: past tense, and no 'push' tone, since its
  // celebrate animation nudges an action that is no longer possible.
  let statusText: string;
  let statusTone: 'ok' | 'push' | 'calm' = 'calm';
  if (!dash.hasCalorieBudgetEstimate) {
    statusText = t('today.no_budget', 'Add weight and height to unlock your budget');
  } else if (isSurplusGoal) {
    if (remaining > 0) {
      statusText = isToday
        ? t('today.surplus_left', '{{kcal}} {{unit}} still to eat for your surplus', { kcal: e(remaining), unit })
        : t('day.surplus_left', 'Finished {{kcal}} {{unit}} short of your surplus', { kcal: e(remaining), unit });
      statusTone = isToday && nearGoal ? 'push' : 'calm';
    } else {
      statusText = t('today.surplus_hit', 'Surplus target reached. Well done!');
      statusTone = 'ok';
    }
  } else if (!over) {
    if (isToday) {
      statusText = nearGoal
        ? t('today.almost_there', 'Almost there: {{kcal}} {{unit}} to go', { kcal: e(remaining), unit })
        : t('today.left_today', '{{kcal}} {{unit}} left today', { kcal: e(remaining), unit });
      statusTone = nearGoal ? 'push' : 'calm';
    } else {
      statusText = nearGoal
        ? t('day.just_under', 'Closed the day {{kcal}} {{unit}} under. Nicely done.', { kcal: e(remaining), unit })
        : t('day.under_budget', 'Finished {{kcal}} {{unit}} under budget', { kcal: e(remaining), unit });
      // Landing just under budget is the best a finished day can do
      statusTone = nearGoal ? 'ok' : 'calm';
    }
  } else if (!meaningfullyOver) {
    statusText = isToday
      ? t('today.on_target', 'Right at your target. Well done!')
      : t('day.on_target', 'Landed right on your target. Well done!');
    statusTone = 'ok';
  } else {
    statusText = isToday
      ? t('today.over_recover', 'Over by {{kcal}} {{unit}}. One day never ruins a week: tomorrow adjusts automatically.', { kcal: e(remaining), unit })
      : t('day.over_recover', 'Over by {{kcal}} {{unit}} that day. One day never ruins a week.', { kcal: e(remaining), unit });
  }

  const protein = dash.totalProteinGrams;
  const proteinGoal = dash.snapshotProteinGoalGrams;

  return (
    <Card className="relative flex flex-col items-center pt-5 pb-4">
      {/* Names the budget the ring is measured against. Sibling of the ring
          button, never inside it: nested buttons are invalid. */}
      <CalorieModeTag className="absolute top-3 left-3" />

      <button
        type="button"
        onClick={onOpenDetails}
        className="pressable absolute top-3 right-3 flex items-center gap-0.5 rounded-full bg-inset active:bg-press px-2.5 py-1.5 text-[12px] font-semibold text-ink-2"
      >
        {t('today.details', 'Details')}
        <Icon name="chevronRight" size={13} />
      </button>

      <button
        type="button"
        onClick={onOpenDetails}
        aria-label={t('today.details_aria', 'Open day details: eaten, budget, burned and your week')}
        className="pressable flex flex-col items-center"
      >
        <ProgressRing
          progress={progress}
          size={158}
          color={ringColor}
          label={t('today.ring_aria', 'Calorie progress')}
        >
          <span className="text-[32px] font-extrabold text-ink leading-none tabular-nums">
            {dash.hasCalorieBudgetEstimate ? e(remaining) : e(eaten)}
          </span>
          <span className="text-[13px] font-medium text-ink-2 mt-1.5">
            {dash.hasCalorieBudgetEstimate
              ? over
                ? t('today.ring_over', '{{unit}} over', { unit })
                : isToday
                  ? t('today.ring_left', '{{unit}} left', { unit })
                  : t('day.ring_under', '{{unit}} under', { unit })
              : t('today.ring_eaten', '{{unit}} eaten', { unit })}
          </span>
        </ProgressRing>

        <span
          className={cn(
            'mt-3.5 text-center text-[13px] font-semibold rounded-full px-4 py-2',
            statusTone === 'ok' && 'bg-success-soft text-success',
            statusTone === 'push' && 'bg-primary-soft text-primary-soft-ink animate-celebrate',
            statusTone === 'calm' && 'bg-inset text-ink-2',
          )}
        >
          {statusText}
        </span>
      </button>

      {dash.hasProteinGoal && (
        <div className="mt-4 w-full">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
              <Icon name="zap" size={14} className="text-protein" />
              {t('today.protein', 'Protein')}
            </span>
            <span className="text-[13px] font-bold text-ink tabular-nums">
              {Math.round(protein)}g
              <span className="text-ink-3 font-medium"> / {Math.round(proteinGoal)}g</span>
            </span>
          </div>
          <ProgressBar
            progress={proteinGoal > 0 ? protein / proteinGoal : 0}
            color="var(--t-protein)"
            label={t('today.protein_aria', 'Protein progress')}
          />
        </div>
      )}
    </Card>
  );
}
