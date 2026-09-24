import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { MacroStrip } from '@/components/ui/MacroStrip';
import { Icon, iconOrFallback } from '@/components/ui/Icon';
import { WeekStrip } from './WeekStrip';
import { CalorieModeTag } from '@/components/ui/CalorieModeTag';
import { budgetFor, isSurplusGoalDay } from '@/utils/calorieMath';
import { useMacroPreferences } from '@/hooks/useMacroPreferences';
import { useMacros } from '@/hooks/useMacros';
import {
  dayTargetFor,
  dayTotalsItems,
  formatMacroAmount,
  macroColor,
  macroTotalFor,
  sortKeysByCatalog,
  trackedKeysFromTargets,
} from '@/utils/macros';
import { qtyStr, roundPartsToTotal, toDateString } from '@/utils/format';
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
  const navigate = useNavigate();
  const e = (kcal: number) => Math.round(Math.abs(kcal)).toLocaleString();
  const { defs, get, label } = useMacros();

  // Tracked-macro rows come from the DAY's frozen targets (protein included),
  // so a past day reads exactly as it was lived. Macros tracked NOW but
  // absent from that day get named honestly instead of showing a fabricated
  // zero.
  const { data: prefs } = useMacroPreferences();
  const dayKeys = trackedKeysFromTargets(dash.macroTargets);
  const targetKeys = sortKeysByCatalog(dash.macroTargets.map((m) => m.macroKey), get);
  const untrackedThen = !isToday
    ? (prefs ?? [])
        .filter((p) => p.isTracked && !dayKeys.has(p.macroKey))
        .map((p) => label(p.macroKey))
    : [];

  const budget = Math.max(budgetFor(dash, mode), 1);
  const remaining = budget - dash.totalFoodCaloriesKcal;
  const isSurplus = isSurplusGoalDay(dash);

  // What the "Burned" figure is made of, one tap deeper. Every block after
  // the first is a delta from resting, so sleep reads as a minus: the hours
  // set in Profile become visible consequences instead of hidden inputs.
  const [showBurn, setShowBurn] = useState(false);
  const signed = (n: number) => {
    if (n === 0) return '0';
    return `${n < 0 ? '−' : '+'}${Math.abs(n).toLocaleString()}`;
  };
  const hoursMeta = (h: number) => `${qtyStr(h)} ${t('common.hour_suffix', 'h')}`;
  const hasActivities = dash.activityHours > 0 || dash.totalActivityCaloriesKcal > 0;
  const burnRows: { key: string; label: string; meta: string; kcal: number; plain?: boolean }[] = [
    {
      key: 'resting',
      label: t('today.burn_resting', 'Resting metabolism (BMR)'),
      meta: t('today.burn_all_day', 'all day'),
      kcal: dash.snapshotBMRKcal,
      plain: true,
    },
    ...(dash.sleepHoursUsed !== null
      ? [{ key: 'sleep', label: t('today.burn_sleep', 'Sleep, below resting'), meta: hoursMeta(dash.sleepHoursUsed), kcal: dash.sleepCaloriesKcal }]
      : []),
    ...(dash.neatHoursUsed !== null
      ? [{ key: 'neat', label: t('today.burn_neat', 'Everyday movement'), meta: hoursMeta(dash.neatHoursUsed), kcal: dash.neatCaloriesKcal }]
      : []),
    { key: 'idle', label: t('today.burn_idle', 'Other awake time'), meta: hoursMeta(dash.hoursRemainingInDay), kcal: dash.idleTimeCaloriesKcal },
    ...(hasActivities
      ? [{
          key: 'activities',
          label: t('today.burn_activities', 'Activities, above resting'),
          meta: dash.activityHours > 0 ? hoursMeta(dash.activityHours) : '',
          kcal: dash.totalActivityCaloriesKcal - dash.activityRestingOffsetKcal,
        }]
      : []),
    { key: 'tef', label: t('today.burn_tef', 'Digesting food'), meta: '', kcal: dash.tefKcal },
  ];
  // Whole numbers that add up to the "Burned" total shown right under them.
  const burnKcal = roundPartsToTotal(burnRows.map((r) => r.kcal), dash.totalDailyExpenditureKcal);

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

        {dash.hasCalorieEstimate && (
          <div className="rounded-card bg-inset px-4 py-1">
            <button
              type="button"
              aria-expanded={showBurn}
              className="pressable flex w-full items-center justify-between h-11 text-left"
              onClick={() => setShowBurn((v) => !v)}
            >
              <span className="text-[14px] font-semibold text-ink-2">
                {t('today.burn_breakdown_toggle', 'What makes up the burn')}
              </span>
              <Icon name={showBurn ? 'chevronUp' : 'chevronDown'} size={16} className="text-ink-3 shrink-0" />
            </button>

            {showBurn && (
              <div className="border-t border-hairline/60 pb-2">
                {burnRows.map((r, i) => (
                  <div key={r.key} className="flex items-center justify-between gap-3 h-10">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink-2">
                      {r.label}
                      {r.meta && <span className="ml-1.5 font-medium text-ink-3">{r.meta}</span>}
                    </span>
                    <span className="shrink-0 text-[13px] font-bold tabular-nums text-ink">
                      {r.plain ? burnKcal[i].toLocaleString() : signed(burnKcal[i])} kcal
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between h-10 border-t border-hairline/60">
                  <span className="text-[13px] font-bold text-ink">{t('today.burned', 'Burned')}</span>
                  <span className="text-[13px] font-extrabold tabular-nums text-ink">
                    {e(dash.totalDailyExpenditureKcal)} kcal
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-ink-3 leading-relaxed">
                  {t(
                    'today.burn_note',
                    'Activities show only what they add above resting; their resting share already sits in the first line. Sleep and movement hours are set in Profile.',
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="rounded-card bg-inset px-4 py-3">
          <p className="text-[13px] font-bold text-ink-2 uppercase tracking-wide mb-2">
            {isToday
              ? t('today.macro_totals', 'Macros so far')
              : t('day.macro_totals', 'Macros for the day')}
          </p>
          <MacroStrip unit items={dayTotalsItems(dash.macroTotals, dayKeys, defs)} />

          {targetKeys.length > 0 && (
            <div className="mt-3 border-t border-hairline/60 pt-1">
              {targetKeys.map((key) => {
                const m = dayTargetFor(dash, key);
                if (!m) return null;
                const def = get(key);
                const value = macroTotalFor(dash, key) ?? 0;
                const limitBroken = m.direction === 'limit' && m.target !== null && value > m.target;
                return (
                  <div key={key} className="flex items-center justify-between h-9">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
                      <Icon name={iconOrFallback(def.icon)} size={14} style={{ color: macroColor(key) }} />
                      {label(def)}
                    </span>
                    <span className={cn('text-[13px] font-bold tabular-nums', limitBroken ? 'text-warning' : 'text-ink')}>
                      {formatMacroAmount(def, value)}
                      {m.target !== null && (
                        <span className="text-ink-3 font-medium">
                          {' '}
                          {m.direction === 'limit'
                            ? t('macros.of_limit', 'of {{limit}} limit', { limit: formatMacroAmount(def, m.target) })
                            : `/ ${formatMacroAmount(def, m.target)}`}
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
