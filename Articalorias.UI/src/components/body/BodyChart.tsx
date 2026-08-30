import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseDate, toDateString, addDays } from '@/utils/format';
import { kgToDisplay, weightLabel, type WeightUnit } from '@/utils/units';
import { cn } from '@/utils/cn';

export interface ChartPoint {
  date: string; // yyyy-MM-dd
  value: number; // kg (converted for display here) or bf %
  /** Estimated (hollow) vs recorded (solid) point */
  estimated?: boolean;
}

interface BodyChartProps {
  metric: 'weight' | 'bodyFat';
  points: ChartPoint[];
  weightUnit: WeightUnit;
  /**
   * kg per day the user's calorie goal aims for (negative = losing).
   * Draws the dashed "at your goal pace" projection from the last point.
   */
  goalKgPerDay?: number | null;
}

const W = 344;
const H = 180;
const PAD_L = 40;
const PAD_R = 10;
const PAD_T = 12;
const PAD_B = 22;
const PROJECTION_DAYS = 28;

/**
 * Rounded tick values covering [min, max]: picks a 1/2/2.5/5 × 10^n step so
 * labels read "70, 72.5, 75", never "71.3, 73.8". At most `count` + 1 ticks.
 */
function niceTicks(min: number, max: number, count: number): number[] {
  const span = Math.max(max - min, 1e-6);
  const rawStep = span / count;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / mag;
  const step = (norm >= 5 ? 5 : norm >= 2.5 ? 2.5 : norm >= 2 ? 2 : 1) * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step)
    ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/**
 * Weight / body-fat line over time. Hand-rolled SVG in the app's chart
 * idiom: no library, no focusable svg internals, colors from tokens.
 * Recorded measurements are solid dots on a line; formula estimates are
 * hollow, so data and derivation never look alike. The dashed tail is the
 * trajectory at the CURRENT calorie goal, giving "where am I heading if I
 * keep this plan" without pretending to be a prediction.
 */
export function BodyChart({ metric, points, weightUnit, goalKgPerDay }: BodyChartProps) {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);

  const model = useMemo(() => {
    if (points.length === 0) return null;

    const today = toDateString();
    const first = points[0].date;
    const lastPoint = points[points.length - 1];

    // Projection at the goal pace, weight only, anchored on the last point.
    const project =
      metric === 'weight' && goalKgPerDay != null && goalKgPerDay !== 0 && !lastPoint.estimated;
    const projEnd = project ? addDays(today, PROJECTION_DAYS) : lastPoint.date;
    const projEndValue = project
      ? lastPoint.value +
        kgToDisplay(goalKgPerDay ?? 0, weightUnit) *
          Math.max(daysBetween(lastPoint.date, projEnd), 0)
      : lastPoint.value;

    const t0 = parseDate(first).getTime();
    const t1 = Math.max(parseDate(projEnd).getTime(), parseDate(lastPoint.date).getTime());
    const spanMs = Math.max(t1 - t0, 86400000);

    const values = points.map((p) => p.value).concat(project ? [projEndValue] : []);
    let vMin = Math.min(...values);
    let vMax = Math.max(...values);
    const spread = Math.max(vMax - vMin, metric === 'weight' ? 1 : 0.8);
    vMin -= spread * 0.18;
    vMax += spread * 0.18;

    const x = (date: string) =>
      PAD_L + ((parseDate(date).getTime() - t0) / spanMs) * (W - PAD_L - PAD_R);
    const y = (v: number) => PAD_T + (1 - (v - vMin) / (vMax - vMin)) * (H - PAD_T - PAD_B);

    const coords = points.map((p) => ({ ...p, cx: x(p.date), cy: y(p.value) }));
    const solid = coords.filter((c) => !c.estimated);
    const linePath = solid.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.cx.toFixed(1)},${c.cy.toFixed(1)}`).join(' ');
    const estPath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.cx.toFixed(1)},${c.cy.toFixed(1)}`).join(' ');

    const projection = project
      ? {
          x1: x(lastPoint.date),
          y1: y(lastPoint.value),
          x2: x(projEnd),
          y2: y(projEndValue),
        }
      : null;

    // Y guides: rounded steps instead of the raw min/max, so the scale is
    // readable at a glance without turning into a dense grid.
    const yTicks = niceTicks(vMin, vMax, 3).map((v) => ({ v, yy: y(v) }));

    // X guides: first and last date always; up to two interior dates when the
    // span has room for them (labels are ~44px wide on a 344px canvas).
    const spanDays = spanMs / 86400000;
    const xTicks: { date: string; xx: number }[] = [];
    if (spanDays >= 21) {
      for (const frac of spanDays >= 45 ? [1 / 3, 2 / 3] : [0.5]) {
        const ms = t0 + spanMs * frac;
        const d = new Date(ms);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        xTicks.push({ date: iso, xx: PAD_L + ((ms - t0) / spanMs) * (W - PAD_L - PAD_R) });
      }
    }

    return { coords, solid, linePath, estPath, projection, vMin, vMax, x, y, yTicks, xTicks };
  }, [points, metric, goalKgPerDay, weightUnit]);

  if (!model) return null;

  const fmtValue = (v: number) =>
    metric === 'weight'
      ? `${(Math.round(v * 10) / 10).toLocaleString(i18n.language)} ${weightLabel(weightUnit)}`
      : `${Math.round(v * 10) / 10}%`;

  // When the visible span crosses a year boundary, every axis label carries
  // its (short) year: "12 Aug" vs "12 Aug 25" — otherwise two identical-
  // looking dates could be twelve months apart.
  const multiYear =
    parseDate(model.coords[0].date).getFullYear() !==
    parseDate(model.coords[model.coords.length - 1].date).getFullYear();
  const fmtDate = (d: string) =>
    new Intl.DateTimeFormat(
      i18n.language,
      multiYear
        ? { day: 'numeric', month: 'short', year: '2-digit' }
        : { day: 'numeric', month: 'short' },
    ).format(parseDate(d));

  const color = metric === 'weight' ? 'var(--t-primary)' : 'var(--t-protein)';
  const hasEstimates = model.coords.some((c) => c.estimated);
  const sel = selected !== null ? model.coords[selected] : null;

  // Tap anywhere on the plot: select the nearest measurement.
  const onPick = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    model.coords.forEach((c, i) => {
      const d = Math.abs(c.cx - px);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setSelected((cur) => (cur === best ? null : best));
  };

  return (
    <div className="select-none">
      {/* Readout row: fixed height so selecting never reflows the chart. */}
      <div className="h-6 flex items-center justify-between text-[12px]">
        {sel ? (
          <>
            <span className="font-semibold text-ink-2 capitalize">{fmtDate(sel.date)}</span>
            <span className="font-bold text-ink tabular-nums">
              {fmtValue(sel.value)}
              {sel.estimated && (
                <span className="text-ink-3 font-medium"> {t('body.estimated_tag', '(estimated)')}</span>
              )}
            </span>
          </>
        ) : (
          <span className="text-ink-3">{t('body.chart_tap_hint', 'Tap the chart to read a point')}</span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        role="img"
        aria-label={
          metric === 'weight'
            ? t('body.chart_aria_weight', 'Weight over time chart')
            : t('body.chart_aria_bf', 'Body fat over time chart')
        }
        onPointerDown={onPick}
      >
        {/* Y guides: rounded values on a quiet grid; the top one names the
            unit so the whole axis is self-describing. */}
        {model.yTicks.map(({ v, yy }, i) => {
          const valueLabel = metric === 'weight'
            ? String(Math.round(v * 10) / 10)
            : (Math.round(v * 10) / 10).toFixed(1);
          const isTop = i === model.yTicks.length - 1;
          return (
            <g key={v}>
              <line x1={PAD_L} x2={W - PAD_R} y1={yy} y2={yy} stroke="var(--t-hairline)" strokeWidth="1" />
              <text x={PAD_L - 5} y={yy + 3} textAnchor="end" fontSize="9" fill="var(--t-ink-3)">
                {isTop
                  ? metric === 'weight'
                    ? `${valueLabel} ${weightLabel(weightUnit)}`
                    : `${valueLabel}%`
                  : valueLabel}
              </text>
            </g>
          );
        })}

        {/* Estimated path under the real one (dashed, muted) */}
        {hasEstimates && (
          <path d={model.estPath} fill="none" stroke={color} strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 4" />
        )}

        {/* Recorded line */}
        {model.solid.length > 1 && (
          <path d={model.linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Goal-pace projection */}
        {model.projection && (
          <line
            x1={model.projection.x1}
            y1={model.projection.y1}
            x2={model.projection.x2}
            y2={model.projection.y2}
            stroke="var(--t-ink-3)"
            strokeWidth="1.5"
            strokeDasharray="5 5"
          />
        )}

        {/* Dots: solid = recorded, hollow = estimated */}
        {model.coords.map((c, i) => (
          <circle
            key={c.date}
            cx={c.cx}
            cy={c.cy}
            r={selected === i ? 5 : 3.5}
            fill={c.estimated ? 'var(--t-card)' : color}
            stroke={color}
            strokeWidth={c.estimated ? 1.5 : 0}
          />
        ))}

        {/* Selected crosshair */}
        {sel && (
          <line x1={sel.cx} x2={sel.cx} y1={PAD_T} y2={H - PAD_B} stroke={color} strokeOpacity="0.3" strokeWidth="1" />
        )}

        {/* X labels: first and last dates anchored to the edges, plus one or
            two interior dates (with tick marks) when the span has room. */}
        <text x={PAD_L} y={H - 7} fontSize="9" fill="var(--t-ink-3)">
          {fmtDate(model.coords[0].date)}
        </text>
        {model.xTicks.map(({ date, xx }) => (
          <g key={date}>
            <line x1={xx} x2={xx} y1={H - PAD_B} y2={H - PAD_B + 3} stroke="var(--t-ink-3)" strokeWidth="1" />
            <text x={xx} y={H - 7} textAnchor="middle" fontSize="9" fill="var(--t-ink-3)">
              {fmtDate(date)}
            </text>
          </g>
        ))}
        <text x={W - PAD_R} y={H - 7} textAnchor="end" fontSize="9" fill="var(--t-ink-3)">
          {fmtDate(model.coords[model.coords.length - 1].date)}
        </text>
      </svg>

      {/* Legend: only the encodings actually on screen */}
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
        <LegendKey swatch={<span className="h-0.5 w-4 rounded-full" style={{ background: color }} />} label={t('body.legend_recorded', 'Recorded')} />
        {hasEstimates && (
          <LegendKey
            swatch={<span className="h-2.5 w-2.5 rounded-full border-2 bg-card" style={{ borderColor: color }} />}
            label={t('body.legend_estimated', 'Estimated')}
          />
        )}
        {model.projection && (
          <LegendKey
            swatch={
              <span className="flex w-4 items-center justify-between">
                <span className="h-0.5 w-1 bg-ink-3" />
                <span className="h-0.5 w-1 bg-ink-3" />
              </span>
            }
            label={t('body.legend_projection', 'At your goal pace')}
          />
        )}
      </div>
    </div>
  );
}

function LegendKey({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span className={cn('flex items-center gap-1.5')}>
      <span aria-hidden="true" className="flex items-center">{swatch}</span>
      <span className="text-[11px] font-semibold text-ink-2">{label}</span>
    </span>
  );
}

function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}
