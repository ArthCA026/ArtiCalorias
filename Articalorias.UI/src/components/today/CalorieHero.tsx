import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { ProgressRing } from '@/components/ui/Progress';
import { Icon } from '@/components/ui/Icon';
import { CalorieModeTag } from '@/components/ui/CalorieModeTag';
import { MacroBars } from '@/components/today/MacroSummaryCard';
import { budgetFor, isSurplusGoalDay } from '@/utils/calorieMath';
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
 *
 * The whole presentation flips with the day's goal direction. On a deficit or
 * maintenance day, staying under budget is the win and going over warns. On a
 * surplus (gaining) day, reaching the budget is the win: the ring turns green
 * on arrival and going past it stays calm, never alarming.
 */
export function CalorieHero({ dash, mode, isToday, onOpenDetails }: CalorieHeroProps) {
  const { t } = useTranslation();

  const eaten = dash.totalFoodCaloriesKcal;

  // No weight or height = no budget, so there is nothing honest for a ring,
  // a mode switch or a details ledger to say. Show only what IS real (what
  // was eaten, plus any tracked macro amounts) until the profile unlocks the
  // rest; the banner above this card carries the call to action.
  if (!dash.hasCalorieBudgetEstimate) {
    return (
      <Card className="pt-5 pb-4">
        <div className="flex flex-col items-center">
          <span className="text-[32px] font-extrabold text-ink leading-none tabular-nums">
            {Math.round(eaten).toLocaleString()}
          </span>
          <span className="mt-1.5 text-[13px] font-medium text-ink-2">
            {isToday
              ? t('today.locked_eaten', 'kcal eaten today')
              : t('day.locked_eaten', 'kcal eaten that day')}
          </span>
          <span className="mt-3 flex items-center gap-1.5 rounded-full bg-inset px-4 py-2 text-[13px] font-semibold text-ink-2">
            <Icon name="lock" size={13} className="text-ink-3" />
            {t('today.locked_status', 'Your budget appears once your weight and height are set')}
          </span>
        </div>
        <MacroBars log={dash} className="mt-4 w-full" />
      </Card>
    );
  }
  const budget = Math.max(budgetFor(dash, mode), 1);
  const remaining = budget - eaten;
  const progress = eaten / budget;
  const isSurplusGoal = isSurplusGoalDay(dash);
  const over = remaining < 0;
  const nearGoal = !over && progress >= 0.75 && remaining > 0;

  const e = (kcal: number) => Math.round(Math.abs(kcal)).toLocaleString();
  const unit = 'kcal';

  const meaningfullyOver = over && Math.abs(remaining) > budget * 0.05;
  // Deficit day: warn once meaningfully over. Surplus day: reaching the
  // target is success, so the full ring celebrates instead of warning.
  const ringColor = isSurplusGoal
    ? over
      ? 'var(--t-success)'
      : undefined
    : meaningfullyOver
      ? 'var(--t-warning)'
      : undefined;

  // A past day is a closed record: past tense, and no 'push' tone, since its
  // celebrate animation nudges an action that is no longer possible.
  let statusText: string;
  let statusTone: 'ok' | 'push' | 'calm' = 'calm';
  if (dash.isFastingDay) {
    // A deliberate fast: no nudges to eat, no alarm about the untouched ring.
    statusText = isToday
      ? t('today.fasting_status', 'Fasting today. Your streak is safe and the deficit counts toward your week.')
      : t('day.fasting_status', 'A fasting day. Its full deficit went into that week.');
    statusTone = isToday ? 'ok' : 'calm';
  } else if (isSurplusGoal) {
    if (remaining > 0) {
      statusText = isToday
        ? t('today.surplus_left', '{{kcal}} {{unit}} still to eat for your surplus', { kcal: e(remaining), unit })
        : t('day.surplus_left', 'Finished {{kcal}} {{unit}} short of your surplus', { kcal: e(remaining), unit });
      statusTone = isToday && nearGoal ? 'push' : 'calm';
    } else if (!meaningfullyOver) {
      statusText = isToday
        ? t('today.surplus_hit', 'Surplus target reached. Well done!')
        : t('day.surplus_hit', 'Surplus target reached that day. Well done!');
      statusTone = 'ok';
    } else {
      // Well past the surplus: still a win, just steer gently back.
      statusText = isToday
        ? t('today.surplus_over', 'Target reached, plus {{kcal}} {{unit}} extra. Tomorrow rebalances it.', { kcal: e(remaining), unit })
        : t('day.surplus_over', 'Went {{kcal}} {{unit}} past the surplus target that day.', { kcal: e(remaining), unit });
      statusTone = isToday ? 'ok' : 'calm';
    }
  } else if (!over) {
    if (isToday) {
      // On a deficit or maintenance day the budget is a CEILING: being a few
      // kcal under it is exactly where the user wants to land, so the close-
      // to-the-line message must read as "nearly used up", never as a target
      // still to be reached ("to go" invited people to eat the difference).
      statusText = nearGoal
        ? t('today.near_limit_v3', 'Only {{kcal}} {{unit}} of budget left.', { kcal: e(remaining), unit })
        : t('today.left_today', '{{kcal}} {{unit}} left today', { kcal: e(remaining), unit });
      statusTone = 'calm';
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

  // The word under the big number, adapted to the goal direction: "over" is a
  // warning on a deficit day but "past goal" (an achievement) on a surplus day.
  const ringSubLabel = over
    ? isSurplusGoal
      ? t('today.ring_past_goal', '{{unit}} past goal', { unit })
      : t('today.ring_over', '{{unit}} over', { unit })
    : isToday
      ? t('today.ring_left', '{{unit}} left', { unit })
      : isSurplusGoal
        ? t('day.ring_short', '{{unit}} short', { unit })
        : t('day.ring_under', '{{unit}} under', { unit });

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
            {e(remaining)}
          </span>
          <span className="text-[13px] font-medium text-ink-2 mt-1.5">{ringSubLabel}</span>
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

      {/* Protein and the other tracked nutrient macros share this card so the
          meal list stays visible without scrolling. Water keeps its own card
          (it carries the quick-add cups). */}
      <MacroBars log={dash} className="mt-4 w-full" />
    </Card>
  );
}
