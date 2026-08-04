import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { MacroStrip } from '@/components/ui/MacroStrip';
import { WeekStrip } from './WeekStrip';
import { CalorieModeTag } from '@/components/ui/CalorieModeTag';
import { budgetFor, isSurplusGoalDay } from '@/utils/calorieMath';
import { cn } from '@/utils/cn';
import type { CalorieMode } from '@/hooks/useCalorieMode';
import type { DailyDashboardResponse } from '@/types';

interface DayDetailsSheetProps {
  open: boolean;
  onClose: () => void;
  dash: DailyDashboardResponse;
  mode: CalorieMode;
  date: string;
  /** Today is still running; a past day is closed */
  isToday: boolean;
}

/**
 * The numbers behind the ring, one tap away: a small ledger that reads
 * top to bottom (eaten, budget, burned) and resolves into one bottom line,
 * plus macro totals and the week at a glance.
 *
 * The mode tag sits inline on the budget row: that is the only number the
 * calorie display mode moves, so it is named exactly where it applies.
 */
export function DayDetailsSheet({ open, onClose, dash, mode, date, isToday }: DayDetailsSheetProps) {
  const { t } = useTranslation();
  const e = (kcal: number) => Math.round(Math.abs(kcal)).toLocaleString();

  const budget = Math.max(budgetFor(dash, mode), 1);
  const remaining = budget - dash.totalFoodCaloriesKcal;
  const isSurplus = isSurplusGoalDay(dash);

  // The bottom line follows the day's goal direction: on a surplus (gaining)
  // day reaching the budget is the win, on a deficit day staying under is.
  let resultLabel = '';
  let resultClass = 'text-ink';
  if (dash.hasCalorieBudgetEstimate) {
    if (isSurplus) {
      if (remaining > 0) {
        resultLabel = isToday
          ? t('today.result_to_surplus', 'To your surplus target')
          : t('day.result_short', 'Short of the surplus target');
        resultClass = isToday ? 'text-ink' : 'text-warning';
      } else {
        resultLabel = t('today.result_past_surplus', 'Past your surplus target');
        resultClass = 'text-success';
      }
    } else {
      if (remaining >= 0) {
        resultLabel = isToday
          ? t('today.result_left', 'Left today')
          : t('day.result_under', 'Finished under');
        resultClass = isToday ? 'text-ink' : 'text-success';
      } else {
        resultLabel = t('today.result_over', 'Over budget');
        resultClass = 'text-warning';
      }
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('today.details_title', 'Day details')}>
      <div className="space-y-4">
        <div className="rounded-card bg-inset px-4 py-1">
          <div className="flex items-center justify-between h-11">
            <span className="text-[14px] font-semibold text-ink-2">
              {t('today.eaten', 'Eaten')}
            </span>
            <span className="text-[15px] font-bold text-ink tabular-nums">
              {e(dash.totalFoodCaloriesKcal)} kcal
            </span>
          </div>
          <div className="flex items-center justify-between h-11 border-t border-hairline/60">
            <span className="flex items-center gap-2 text-[14px] font-semibold text-ink-2">
              {t('today.budget', 'Budget')}
              <CalorieModeTag />
            </span>
            <span className="text-[15px] font-bold text-ink tabular-nums">
              {dash.hasCalorieBudgetEstimate ? `${e(budget)} kcal` : '–'}
            </span>
          </div>
          <div className="flex items-center justify-between h-11 border-t border-hairline/60">
            <span className="text-[14px] font-semibold text-ink-2">
              {t('today.burned', 'Burned')}
            </span>
            <span className="text-[15px] font-bold text-ink tabular-nums">
              {dash.hasCalorieEstimate ? `${e(dash.totalDailyExpenditureKcal)} kcal` : '–'}
            </span>
          </div>
          {dash.hasCalorieBudgetEstimate && (
            <div className="flex items-center justify-between h-12 border-t-2 border-hairline">
              <span className={cn('text-[14px] font-bold', resultClass)}>{resultLabel}</span>
              <span className={cn('text-[17px] font-extrabold tabular-nums', resultClass)}>
                {e(remaining)} kcal
              </span>
            </div>
          )}
        </div>

        <div className="rounded-card bg-inset px-4 py-3">
          <p className="text-[13px] font-bold text-ink-2 uppercase tracking-wide mb-2">
            {isToday
              ? t('today.macro_totals', 'Macros so far')
              : t('day.macro_totals', 'Macros for the day')}
          </p>
          <MacroStrip
            unit
            protein={dash.totalProteinGrams}
            fat={dash.totalFatGrams}
            carbs={dash.totalCarbsGrams}
          />
        </div>

        <WeekStrip
          date={date}
          baseGoalKcal={dash.snapshotDailyBaseGoalKcal}
          mode={mode}
          inset
        />
      </div>
    </Sheet>
  );
}
