import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { MacroStrip } from '@/components/ui/MacroStrip';
import { Icon } from '@/components/ui/Icon';
import { WeekStrip } from './WeekStrip';
import { CalorieModeTag } from '@/components/ui/CalorieModeTag';
import { budgetFor, isSurplusGoalDay } from '@/utils/calorieMath';
import { useMacroPreferences } from '@/hooks/useMacroPreferences';
import { MACRO_META, formatMacroAmount, macroLabel, macroTotalFor } from '@/utils/macros';
import { toDateString } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { CalorieMode } from '@/hooks/useCalorieMode';
import type { DailyDashboardResponse, MacroKey } from '@/types';

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
  const navigate = useNavigate();
  const e = (kcal: number) => Math.round(Math.abs(kcal)).toLocaleString();

  // Tracked-macro rows come from the DAY's frozen targets, so a past day
  // reads exactly as it was lived. Macros tracked NOW but absent from that
  // day get named honestly instead of showing a fabricated zero.
  const { data: prefs } = useMacroPreferences();
  const dayKeys = new Set(dash.macroTargets.map((m) => m.macroKey));
  const untrackedThen = !isToday
    ? (prefs ?? [])
        .filter((p) => p.isTracked && !dayKeys.has(p.macroKey))
        .map((p) => macroLabel(t, p.macroKey))
    : [];

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

          {dash.macroTargets.length > 0 && (
            <div className="mt-3 border-t border-hairline/60 pt-1">
              {dash.macroTargets.map((m) => {
                const key = m.macroKey as MacroKey;
                const value = macroTotalFor(dash, key) ?? 0;
                const limitBroken = m.direction === 'limit' && m.target !== null && value > m.target;
                return (
                  <div key={key} className="flex items-center justify-between h-9">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
                      <Icon name={MACRO_META[key].icon} size={14} style={{ color: MACRO_META[key].color }} />
                      {macroLabel(t, key)}
                    </span>
                    <span className={cn('text-[13px] font-bold tabular-nums', limitBroken ? 'text-warning' : 'text-ink')}>
                      {formatMacroAmount(key, value)}
                      {m.target !== null && (
                        <span className="text-ink-3 font-medium">
                          {' '}
                          {m.direction === 'limit'
                            ? t('macros.of_limit', 'of {{limit}} limit', { limit: formatMacroAmount(key, m.target) })
                            : `/ ${formatMacroAmount(key, m.target)}`}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {untrackedThen.length > 0 && (
            <p className="mt-2 text-[12px] text-ink-3 leading-relaxed">
              {t('day.macros_untracked_then', 'Not tracked on this day: {{macros}}. Tracking starts counting from the day you turn it on.', {
                macros: untrackedThen.join(', '),
              })}
            </p>
          )}
        </div>

        <WeekStrip
          date={date}
          baseGoalKcal={dash.snapshotDailyBaseGoalKcal}
          inset
          onPickDay={(day) => {
            onClose();
            navigate(day === toDateString() ? '/today' : `/day/${day}`);
          }}
        />
      </div>
    </Sheet>
  );
}
