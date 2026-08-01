/**
 * Geometry and scale math for the Day by day chart.
 * Pure numbers, no React and no DOM: the chart is hand drawn from these.
 *
 * Vertical geometry is fixed px, horizontal is flex, so the chart needs no
 * measurement, no ResizeObserver and no svg viewBox.
 */

/** Plot height in px: the half above the plan line plus the half below. */
export const PLOT_H = 208;
/** Distance from the top of the plot down to the plan line. */
export const HALF = PLOT_H / 2;
/** Weekday letter band under the plot. */
export const XBAND_H = 20;
/** Y rail width. Fits a signed four digit tick at 10px tabular figures. */
export const RAIL_W = 44;
/** Bar thickness, capped so every column keeps air on both sides. */
export const BAR_W = 22;
/** A nonzero delta always shows something, however small. */
export const MIN_BAR_H = 3;
/** Popover width, fixed so edge clamping needs no measurement. */
export const TIP_W = 176;
/**
 * Smallest half domain, in kcal. Without it, a week where every day landed
 * within 20 kcal of plan would draw full height bars and read as a disaster.
 */
export const DOMAIN_FLOOR_KCAL = 200;

/** Round up to a clean axis number: 1, 2, 2.5, 5 or 10 times a power of ten. */
export function niceCeil(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 0;
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * mag;
}

/**
 * Symmetric half domain, in display units. Symmetric on purpose: +200 and
 * -200 must draw the same length or the chart lies about polarity.
 */
export function buildDomain(values: number[], floorDisplay: number): number {
  const maxAbs = values.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  return Math.max(niceCeil(maxAbs), niceCeil(floorDisplay), 1);
}

/** Bar length in px for a signed display value. Exactly zero draws no bar. */
export function barHeight(value: number, domain: number): number {
  if (value === 0 || domain <= 0) return 0;
  const raw = (Math.abs(value) / domain) * HALF;
  return Math.min(HALF, Math.max(MIN_BAR_H, Math.round(raw)));
}

/**
 * Horizontal centre of column `index` as a CSS expression, measured from the
 * left edge of the chart root. Used by both the columns and the popover, so
 * the caret always lands on the bar it points at.
 */
export function columnCentre(index: number): string {
  return `calc(${RAIL_W}px + (100% - ${RAIL_W}px) * ${(index + 0.5) / 7})`;
}
