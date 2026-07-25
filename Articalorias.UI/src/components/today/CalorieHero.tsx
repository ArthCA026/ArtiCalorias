import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { ProgressRing, ProgressBar } from '@/components/ui/Progress';
import { Icon } from '@/components/ui/Icon';
import { useUnits } from '@/hooks/useUnits';
import { kcalToDisplay, energyLabel } from '@/utils/units';
import { cn } from '@/utils/cn';
import type { CalorieMode } from '@/hooks/useCalorieMode';
import type { DailyDashboardResponse } from '@/types';

interface CalorieHeroProps {
  dash: DailyDashboardResponse;
  mode: CalorieMode;
}

/** Budget for the ring, depending on the selected calorie mode. */
// eslint-disable-next-line react-refresh/only-export-components -- pure helper tied to this component
export function budgetFor(dash: DailyDashboardResponse, mode: CalorieMode): number {
  switch (mode) {
    case 'net':
      return dash.totalDailyExpenditureKcal;
    case 'goal':
      return dash.totalFoodCaloriesKcal + dash.caloriesRemainingToDailyTargetKcal;
    case 'adjusted':
    default:
      return dash.totalDailyExpenditureKcal + dash.suggestedDailyAverageRemainingKcal;
  }
}

/**
 * The Today centerpiece: calorie ring with remaining energy, plus the
 * eaten / burned / protein summary. Copy leans into the goal gradient
 * (progress accelerates motivation near the target) and avoids
 * guilt-framing when a day goes over.
 */
export function CalorieHero({ dash, mode }: CalorieHeroProps) {
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

  // Ring color: warning only when meaningfully past a deficit budget.
  // For surplus goals going past the target is fine, never alarming.
  const meaningfullyOver = over && Math.abs(remaining) > budget * 0.05;
  const ringColor = !isSurplusGoal && meaningfullyOver ? 'var(--t-warning)' : undefined;

  let statusText: string;
  let statusTone: 'ok' | 'push' | 'calm' = 'calm';
  if (!dash.hasCalorieBudgetEstimate) {
    statusText = t('today.no_budget', 'Add weight and height to unlock your budget');
  } else if (isSurplusGoal) {
    if (remaining > 0) {
      statusText = t('today.surplus_left', '{{kcal}} {{unit}} still to eat for your surplus', { kcal: e(remaining), unit });
      statusTone = nearGoal ? 'push' : 'calm';
    } else {
      statusText = t('today.surplus_hit', 'Surplus target reached. Well done!');
      statusTone = 'ok';
    }
  } else if (!over) {
    statusText = nearGoal
      ? t('today.almost_there', 'Almost there: {{kcal}} {{unit}} to go', { kcal: e(remaining), unit })
      : t('today.left_today', '{{kcal}} {{unit}} left today', { kcal: e(remaining), unit });
    statusTone = nearGoal ? 'push' : 'calm';
  } else if (!meaningfullyOver) {
    statusText = t('today.on_target', 'Right at your target. Well done!');
    statusTone = 'ok';
  } else {
    statusText = t('today.over_recover', 'Over by {{kcal}} {{unit}}. One day never ruins a week: tomorrow adjusts automatically.', { kcal: e(remaining), unit });
  }

  const protein = dash.totalProteinGrams;
  const proteinGoal = dash.snapshotProteinGoalGrams;

  return (
    <Card className="flex flex-col items-center pt-6 pb-5">
      <ProgressRing
        progress={progress}
        color={ringColor}
        label={t('today.ring_aria', 'Calorie progress')}
      >
        <span className="text-[34px] font-extrabold text-ink leading-none tabular-nums">
          {dash.hasCalorieBudgetEstimate ? e(remaining) : e(eaten)}
        </span>
        <span className="text-[13px] font-medium text-ink-2 mt-1.5">
          {dash.hasCalorieBudgetEstimate
            ? over
              ? t('today.ring_over', '{{unit}} over', { unit })
              : t('today.ring_left', '{{unit}} left', { unit })
            : t('today.ring_eaten', '{{unit}} eaten', { unit })}
        </span>
      </ProgressRing>

      <p
        className={cn(
          'mt-4 text-center text-[13px] font-semibold rounded-full px-4 py-2',
          statusTone === 'ok' && 'bg-success-soft text-success',
          statusTone === 'push' && 'bg-primary-soft text-primary-soft-ink animate-celebrate',
          statusTone === 'calm' && 'bg-inset text-ink-2',
        )}
      >
        {statusText}
      </p>

      <div className="mt-5 w-full grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-inset px-2 py-3 text-center">
          <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide">
            {t('today.eaten', 'Eaten')}
          </p>
          <p className="mt-1 text-[15px] font-bold text-ink tabular-nums">{e(eaten)}</p>
        </div>
        <div className="rounded-2xl bg-inset px-2 py-3 text-center">
          <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide">
            {t('today.budget', 'Budget')}
          </p>
          <p className="mt-1 text-[15px] font-bold text-ink tabular-nums">
            {dash.hasCalorieBudgetEstimate ? e(budget) : '–'}
          </p>
        </div>
        <div className="rounded-2xl bg-inset px-2 py-3 text-center">
          <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide">
            {t('today.burned', 'Burned')}
          </p>
          <p className="mt-1 text-[15px] font-bold text-ink tabular-nums">
            {dash.hasCalorieEstimate ? e(dash.totalDailyExpenditureKcal) : '–'}
          </p>
        </div>
      </div>

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
