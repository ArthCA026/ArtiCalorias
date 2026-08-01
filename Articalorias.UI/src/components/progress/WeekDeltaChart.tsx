import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { CalorieModeTag } from '@/components/ui/CalorieModeTag';
import { calorieModeShortLabel } from '@/components/ui/calorieModeLabels';
import { useUnits } from '@/hooks/useUnits';
import { useHaptics } from '@/hooks/useHaptics';
import { energyLabel, kcalToDisplay } from '@/utils/units';
import { addDays, parseDate, toDateString } from '@/utils/format';
import { deltaFor, hasComparablePlan, isFavorableFor, isSurplusGoalDay } from '@/utils/calorieMath';
import { cn } from '@/utils/cn';
import {
  BAR_W,
  DOMAIN_FLOOR_KCAL,
  HALF,
  PLOT_H,
  RAIL_W,
  XBAND_H,
  barHeight,
  buildDomain,
} from './deltaScale';
import { DayDeltaPopover, type DayTipModel } from './DayDeltaPopover';
import type { CalorieMode } from '@/hooks/useCalorieMode';
import type { DailyLogResponse } from '@/types';

interface WeekDeltaChartProps {
  /** Monday of the shown week, yyyy-MM-dd */
  monday: string;
  days: DailyLogResponse[];
  /** Active calorie display mode, so the bars match the ring on Today */
  mode: CalorieMode;
}

interface Slot {
  date: string;
  /** Only set once the day actually has food on it. */
  log: DailyLogResponse | null;
  /** Signed delta in the display unit, rounded. null when there is no log. */
  value: number | null;
  favorable: boolean;
  isFuture: boolean;
  letter: string;
}

/**
 * One bar per weekday showing how far the day landed from its plan.
 *
 * Hand drawn from divs rather than a chart library: the whole chart is seven
 * real buttons, so there is no focusable svg for mobile browsers to paint
 * focus and selection chrome onto, and tapping a bar can open a readout.
 * Nothing here may be given a tabIndex and nothing may be made selectable.
 *
 * Color is a status encoding, not identity: primary means the day went the
 * way its own goal needed, which on a surplus day is a positive delta and on
 * a deficit day a negative one, so a green bar can point either way. The
 * legend, the footnote and the popover carry that in words.
 *
 * Keep --t-primary for the favorable bars. Unifying them with the --t-success
 * chips in the Days list below would drop the colorblind separation against
 * --t-warning from a comfortable pass into the warn band.
 *
 * Light mode bar fills sit just under 3:1 on the card surface, which is only
 * acceptable because every value is also readable as text: in the popover, in
 * each bar's accessible name, and in the Days list under this card. Do not
 * remove those without restating the colors.
 */
export function WeekDeltaChart({ monday, days, mode }: WeekDeltaChartProps) {
  const { t, i18n } = useTranslation();
  const { energyUnit } = useUnits();
  const haptics = useHaptics();
  const rootRef = useRef<HTMLDivElement>(null);
  // The selection is stamped with the week it belongs to, so paging away
  // drops it during render. A new week is a new chart and a stale index must
  // never survive the change, not even for one frame.
  const [selection, setSelection] = useState<{ week: string; index: number } | null>(null);
  const selected = selection?.week === monday ? selection.index : null;

  const num = useMemo(
    () => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 }),
    [i18n.language],
  );

  /** Explicit sign with a Unicode minus, matching the chips on this screen. */
  const signed = (v: number) =>
    v === 0 ? '0' : `${v > 0 ? '+' : '−'}${num.format(Math.abs(v))}`;

  const slots = useMemo<Slot[]>(() => {
    const today = toDateString();
    const byDate = new Map(days.map((d) => [d.logDate, d]));
    const narrow = new Intl.DateTimeFormat(i18n.language, { weekday: 'narrow' });
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i);
      const row = byDate.get(date) ?? null;
      // A row can exist with no food on it, and a profile with no weight or
      // height gets zeroed budget fields. Neither may draw a bar: the delta
      // would be the whole day's plan, which on a deficit day renders as a
      // full height favorable bar.
      const log = row && hasComparablePlan(row) ? row : null;
      return {
        date,
        log,
        value: log ? Math.round(kcalToDisplay(deltaFor(log, mode), energyUnit)) : null,
        favorable: log ? isFavorableFor(log, mode) : false,
        isFuture: date > today,
        letter: narrow.format(parseDate(date)),
      };
    });
  }, [days, monday, energyUnit, i18n.language, mode]);

  const domain = useMemo(() => {
    const values = slots.map((s) => s.value).filter((v): v is number => v !== null);
    return buildDomain(values, Math.round(kcalToDisplay(DOMAIN_FLOOR_KCAL, energyUnit)));
  }, [slots, energyUnit]);

  /** Compact ticks keep large kJ domains short. */
  const tick = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language, {
        notation: domain >= 10000 ? 'compact' : 'standard',
        maximumFractionDigits: domain >= 10000 ? 1 : 0,
      }),
    [i18n.language, domain],
  );
  const tickLabel = (v: number) => `${v > 0 ? '+' : '−'}${tick.format(Math.abs(v))}`;

  const weekdayLong = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { weekday: 'long' }),
    [i18n.language],
  );

  const hasAnyLog = slots.some((s) => s.log);

  // The color rule, stated in terms of this week's own goal type, so that a
  // green bar pointing down is explained rather than surprising.
  const colorRule = useMemo(() => {
    const logged = slots.filter((s): s is Slot & { log: DailyLogResponse } => s.log !== null);
    if (logged.length === 0) return '';
    const surplus = logged.filter((s) => isSurplusGoalDay(s.log)).length;
    if (surplus === 0)
      return t('progress.chart_rule_deficit', 'Green is a day at or under its plan.');
    if (surplus === logged.length)
      return t('progress.chart_rule_surplus', 'Green is a day at or over its plan.');
    return t('progress.chart_rule_mixed', 'Green is a day that went the way its own goal needed.');
  }, [slots, t]);

  // Dismiss on a tap anywhere else, or on Escape. Registered only while open.
  useEffect(() => {
    if (selected === null) return;
    const close = () => setSelection(null);
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [selected]);

  const energy = (kcal: number) => num.format(Math.round(kcalToDisplay(kcal, energyUnit)));

  /** The words that follow the number, on the chart and in the readout. */
  const caption = (v: number) =>
    v > 0
      ? t('progress.chart_over', 'over plan')
      : v < 0
        ? t('progress.chart_under', 'under plan')
        : t('progress.chart_on_plan', 'right on plan');

  const tipFor = (i: number): DayTipModel => {
    const s = slots[i];
    const title = weekdayLong.format(parseDate(s.date));
    if (!s.log || s.value === null) {
      return {
        index: i,
        title,
        value: null,
        caption: t('progress.chart_no_log', 'Nothing logged'),
        below: true,
      };
    }
    return {
      index: i,
      title,
      value: signed(s.value),
      caption: caption(s.value),
      stats: [
        {
          label: t('progress.chart_col_eaten', 'Eaten'),
          value: energy(s.log.totalFoodCaloriesKcal),
        },
        {
          label: t('progress.chart_col_burned', 'Burned'),
          value: energy(s.log.totalDailyExpenditureKcal),
        },
        {
          label: t('progress.chart_col_protein', 'Protein'),
          value: `${Math.round(s.log.totalProteinGrams)} g`,
        },
      ],
      // Names both the color rule and the budget the value was measured
      // against, since the readout is the one place a bar becomes a number.
      goalType: `${
        isSurplusGoalDay(s.log)
          ? t('progress.chart_surplus_day', 'Surplus day')
          : t('progress.chart_deficit_day', 'Deficit day')
      } · ${calorieModeShortLabel(t, mode)}`,
      below: s.value >= 0,
    };
  };

  /** Everything the readout shows, as one sentence, for assistive tech. */
  const ariaFor = (s: Slot): string => {
    const day = weekdayLong.format(parseDate(s.date));
    if (!s.log || s.value === null)
      return t('progress.chart_aria_empty', '{{day}}: nothing logged.', { day });
    const unit = energyLabel(energyUnit);
    const status = s.favorable
      ? t('progress.chart_legend_good', 'On plan')
      : t('progress.chart_legend_off', 'Off plan');
    const stats = t(
      'progress.chart_aria_stats',
      '{{eaten}} eaten, {{burned}} burned, {{protein}} g protein.',
      {
        eaten: `${energy(s.log.totalFoodCaloriesKcal)} ${unit}`,
        burned: `${energy(s.log.totalDailyExpenditureKcal)} ${unit}`,
        protein: Math.round(s.log.totalProteinGrams),
      },
    );
    return `${day}: ${signed(s.value)} ${unit} ${caption(s.value)}. ${status}. ${stats}`;
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-bold text-ink-2 uppercase tracking-wide">
          {t('progress.chart_title', 'Day by day')}
        </p>
        <CalorieModeTag />
      </div>
      <p className="mt-0.5 text-[13px] text-ink-2">
        {t('progress.chart_subtitle', 'Distance from your plan, in {{unit}}', {
          unit: energyLabel(energyUnit),
        })}
      </p>

      {!hasAnyLog ? (
        // Empty states teach: say what will appear and where.
        <p className="mt-4 mb-1 text-[13px] text-ink-3 leading-relaxed">
          {t(
            'progress.chart_empty',
            'Log a day and its bar appears here, above or below your plan line.',
          )}
        </p>
      ) : (
        <>
          {/* A status color never travels alone. */}
          <div className="mt-3 flex items-center gap-4">
            <LegendKey color="var(--t-primary)" label={t('progress.chart_legend_good', 'On plan')} />
            <LegendKey color="var(--t-warning)" label={t('progress.chart_legend_off', 'Off plan')} />
          </div>

          {/* select-none is the whole defence against long press selection
              artifacts. Nothing in here is focusable except the buttons. */}
          <div
            ref={rootRef}
            role="group"
            aria-label={t(
              'progress.chart_aria',
              'Day by day chart. Select a day to see its numbers.',
            )}
            className="relative mt-3 select-none"
            style={{ height: PLOT_H + XBAND_H }}
          >
            <div className="absolute inset-0 flex">
              {/* Y rail: three ticks and the name of the line. */}
              <div className="relative shrink-0" style={{ width: RAIL_W }} aria-hidden="true">
                <span className="absolute right-1.5 top-0 text-[10px] font-semibold tabular-nums text-ink-2">
                  {tickLabel(domain)}
                </span>
                <span
                  className="absolute right-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-2"
                  style={{ top: HALF, transform: 'translateY(-50%)' }}
                >
                  {t('progress.chart_plan', 'Plan')}
                </span>
                <span
                  className="absolute right-1.5 text-[10px] font-semibold tabular-nums text-ink-2"
                  style={{ top: PLOT_H, transform: 'translateY(-100%)' }}
                >
                  {tickLabel(-domain)}
                </span>
              </div>

              <div className="relative grow">
                {/* The one rule on the chart, painted under the bars. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 h-px bg-ink-3/60"
                  style={{ top: HALF }}
                />
                <div className="absolute inset-0 flex">
                  {slots.map((s, i) => (
                    <BarColumn
                      key={s.date}
                      slot={s}
                      domain={domain}
                      selected={selected === i}
                      dimmed={selected !== null && selected !== i}
                      label={ariaFor(s)}
                      onSelect={() => {
                        setSelection(selected === i ? null : { week: monday, index: i });
                        haptics.tap();
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {selected !== null && <DayDeltaPopover model={tipFor(selected)} />}
          </div>

          <p className="mt-3 text-[12px] text-ink-3 leading-relaxed">
            {t('progress.chart_axis_hint', 'Above the line is more than planned, below is less.')}{' '}
            {colorRule}
          </p>
        </>
      )}
    </Card>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />
      <span className="text-[11px] font-semibold text-ink-2">{label}</span>
    </span>
  );
}

interface BarColumnProps {
  slot: Slot;
  domain: number;
  selected: boolean;
  dimmed: boolean;
  label: string;
  onSelect: () => void;
}

/**
 * One weekday: the bar and its letter, inside a single button that fills the
 * whole column. Seven of these tile the row with no dead space between them.
 *
 * The column is only around 35px wide on a small phone, because seven 44px
 * columns do not fit inside a max-w-md card. The target carries the 44px
 * intent by area instead: it is the full height of the chart, letter
 * included. Do not shrink it back to the width of the bar.
 */
function BarColumn({ slot, domain, selected, dimmed, label, onSelect }: BarColumnProps) {
  const v = slot.value;
  const h = v === null ? 0 : barHeight(v, domain);
  const up = (v ?? 0) > 0;
  const color = slot.favorable ? 'var(--t-primary)' : 'var(--t-warning)';

  const body = (
    <>
      {v !== null && v !== 0 && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute left-1/2 -translate-x-1/2 transition-[height,top,opacity] duration-500 ease-out',
            up ? 'rounded-t-[4px]' : 'rounded-b-[4px]',
            dimmed && 'opacity-35',
          )}
          style={{ width: BAR_W, height: h, top: up ? HALF - h : HALF, background: color }}
        />
      )}
      {/* Landed exactly on the plan: a cap on the line, not a tiny bar. */}
      {v === 0 && (
        <span
          aria-hidden="true"
          className={cn('absolute left-1/2 -translate-x-1/2 rounded-full', dimmed && 'opacity-35')}
          style={{ width: BAR_W, height: 4, top: HALF - 2, background: color }}
        />
      )}
      {/* Nothing logged: a neutral placeholder, never a colored bar. */}
      {v === null && (
        <span
          aria-hidden="true"
          className="absolute left-1/2 -translate-x-1/2 rounded-full bg-press"
          style={{ width: BAR_W, height: 3, top: HALF - 1.5 }}
        />
      )}
      <span
        className={cn(
          'absolute inset-x-0 bottom-0 flex items-end justify-center text-[11px]',
          selected ? 'font-bold text-ink' : 'font-semibold text-ink-2',
          v === null && !selected && 'opacity-45',
        )}
        style={{ height: XBAND_H }}
      >
        {slot.letter}
      </span>
    </>
  );

  // Future days can never be logged, so they are shown but inert.
  if (slot.isFuture && !slot.log) {
    return (
      <div aria-hidden="true" className="relative flex-1 opacity-45">
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={label}
      className="relative flex-1 rounded-xl transition-opacity duration-150 active:opacity-70"
    >
      {body}
    </button>
  );
}
