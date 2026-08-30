/**
 * Goal-selection utilities: types, config, and pure conversion/formatting helpers.
 * These are kept here so they can be imported by both GoalSelector sub-components
 * and any future pages that need to reason about goal values.
 */
import { formatWeightRate, type WeightUnit } from "@/utils/units";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GoalPresetKey =
  | "maintain"
  | "lose-very-slow"
  | "lose-slow"
  | "lose-moderate"
  | "lose-fast"
  | "lose-aggressive"
  | "gain";

export interface GoalPreset {
  key: GoalPresetKey;
  /** Full label used in tooltips and aria descriptions. */
  label: string;
  /** Short label shown inside the segmented pill. */
  shortLabel: string;
  /** Tooltip / aria description (includes kg/week context). */
  desc: string;
  /** One-sentence human-friendly summary shown in the selected-goal card. */
  humanDesc: string;
  kgPerWeek: number;
  /** Daily kcal adjustment — derived from kgPerWeek via kgPerWeekToKcal. */
  kcal: string;
}

// ─── Conversion helpers ────────────────────────────────────────────────────────

/**
 * Converts a weekly kg target into a daily kcal adjustment.
 * Negative kgPerWeek → calorie deficit (weight loss).
 * Uses the standard 7 700 kcal/kg body-fat approximation.
 */
export function kgPerWeekToKcal(kgPerWeek: number): number {
  return Math.round((kgPerWeek * 7700) / 7);
}

/** Converts a daily kcal value back to a kg/week string for pre-filling the custom input. */
export function kcalToKgPerWeek(kcal: number): string {
  return ((kcal * 7) / 7700).toFixed(2);
}

// ─── Formatting helpers ────────────────────────────────────────────────────────

/** Compact kg/week format for mobile option cards (e.g. "−0.50 kg/wk"). */
export function formatKgPerWeekShort(kg: number, unit: WeightUnit = "kg"): string {
  return formatWeightRate(kg, unit);
}

// ─── Validation helpers ────────────────────────────────────────────────────────

/** Allowed range for the custom weekly weight-change target. */
export const CUSTOM_KG_MIN = -1.50;
export const CUSTOM_KG_MAX =  1.00;

/** The same limits expressed as a daily kcal adjustment (7700 kcal/kg). */
export const CUSTOM_KCAL_MIN = kgPerWeekToKcal(CUSTOM_KG_MIN); // -1650
export const CUSTOM_KCAL_MAX = kgPerWeekToKcal(CUSTOM_KG_MAX); // +1100

/** Validates a raw custom kcal/day string. Returns an error message or null. */
export function validateCustomKcal(value: string): string | null {
  if (!value.trim()) return "Enter a value.";
  const n = parseFloat(value.replace(",", "."));
  if (isNaN(n)) return "Enter a valid number.";
  if (n < CUSTOM_KCAL_MIN) return `Minimum is ${CUSTOM_KCAL_MIN} kcal/day.`;
  if (n > CUSTOM_KCAL_MAX) return `Maximum is +${CUSTOM_KCAL_MAX} kcal/day.`;
  return null;
}

/** "-550" | "+320" | "0" — a signed daily kcal adjustment, compact. */
export function formatSignedKcal(kcal: number): string {
  const r = Math.round(kcal);
  return r > 0 ? `+${r.toLocaleString()}` : r.toLocaleString();
}

/** Validates a raw custom kg/week string. Returns an error message or null. */
export function validateCustomKg(value: string, unit: WeightUnit = "kg"): string | null {
  if (!value.trim()) return "Enter a value.";
  const n = parseFloat(value);
  if (isNaN(n)) return "Enter a valid number.";
  if (unit === "lbs") {
    const kgVal = n / 2.20462;
    if (kgVal < CUSTOM_KG_MIN) return `Minimum is ${(CUSTOM_KG_MIN * 2.20462).toFixed(2)} lbs/week.`;
    if (kgVal > CUSTOM_KG_MAX) return `Maximum is +${(CUSTOM_KG_MAX * 2.20462).toFixed(2)} lbs/week.`;
  } else {
    if (n < CUSTOM_KG_MIN) return `Minimum is ${CUSTOM_KG_MIN} kg/week.`;
    if (n > CUSTOM_KG_MAX) return `Maximum is +${CUSTOM_KG_MAX} kg/week.`;
  }
  return null;
}

/** Returns a soft contextual hint for a valid custom kg/week value, or null if none applies. */
export function getCustomKgHint(value: string): { text: string; icon: "warning" | "info" } | null {
  const n = parseFloat(value);
  if (isNaN(n)) return null;
  if (n < -1.00) return { text: "This is an aggressive target. Consider checking if it is appropriate for you.", icon: "warning" };
  if (n > -0.10 && n < 0.10) return { text: "This is close to maintenance.", icon: "info" };
  if (n > 0) return { text: "This will increase your calorie target for weight gain.", icon: "info" };
  return null;
}

// ─── Goal-by-date ("reach X by DATE") helpers ─────────────────────────────────
//
// The planner turns a target (weight or body fat %) plus a date into the same
// kg/week pace the presets use, then guards it with medically informed limits:
//   loss: at most 1% of current body weight per week, hard-capped at the
//         app-wide 1.50 kg/week (faster loss risks muscle, gallstones, LEA).
//   gain: at most 0.50% of body weight per week, hard-capped at 1.00 kg/week
//         (faster surplus is mostly fat gain).
// Body-fat targets are additionally floored at essential fat levels.

/** Fastest medically reasonable LOSS pace (kg/week, positive number). */
export function maxSafeLossKgPerWeek(currentWeightKg: number): number {
  return Math.min(currentWeightKg * 0.01, Math.abs(CUSTOM_KG_MIN));
}

/** Fastest reasonable GAIN pace (kg/week, positive number). */
export function maxSafeGainKgPerWeek(currentWeightKg: number): number {
  return Math.min(currentWeightKg * 0.005, CUSTOM_KG_MAX);
}

/** Essential body-fat floor: targets below this are refused outright. */
export function minBodyFatPercentFor(sex: string | null | undefined): number {
  return sex === 'M' ? 5 : 12;
}

/**
 * Converts a body-fat % target into the weight that reaches it with lean mass
 * held constant (the only defensible assumption for a planning tool):
 *   leanKg = current × (1 − bf/100);  targetKg = leanKg / (1 − targetBf/100)
 */
export function weightForBodyFatTarget(
  currentWeightKg: number,
  currentBfPercent: number,
  targetBfPercent: number,
): number {
  const leanKg = currentWeightKg * (1 - currentBfPercent / 100);
  return Math.round((leanKg / (1 - targetBfPercent / 100)) * 10) / 10;
}

export interface TargetPlan {
  /** Signed pace needed to land on the date (negative = losing). */
  kgPerWeek: number;
  /** Same pace as a signed daily kcal adjustment. */
  kcalPerDay: number;
  /** Whole weeks (fractional) between today and the target date. */
  weeks: number;
  /** null = pace is inside safe limits; otherwise the verdict for the UI. */
  verdict: 'too-fast-loss' | 'too-fast-gain' | null;
  /** Date (yyyy-MM-dd) the target IS reachable by at the fastest safe pace. */
  safeDate: string | null;
  /** The fastest safe signed pace for this direction (kg/week). */
  safeKgPerWeek: number;
}

/**
 * The whole plan for "weigh targetKg by dateStr". Pure math, no clamping:
 * the caller decides whether an unsafe verdict blocks saving (it should).
 */
export function planForTarget(
  currentWeightKg: number,
  targetWeightKg: number,
  todayStr: string,
  dateStr: string,
): TargetPlan | null {
  const days = daysBetweenDates(todayStr, dateStr);
  if (days < 7) return null; // Under a week is noise, not a plan.

  const weeks = days / 7;
  const deltaKg = targetWeightKg - currentWeightKg;
  const kgPerWeek = deltaKg / weeks;
  const losing = deltaKg < 0;

  const safeMagnitude = losing
    ? maxSafeLossKgPerWeek(currentWeightKg)
    : maxSafeGainKgPerWeek(currentWeightKg);
  const safeKgPerWeek = losing ? -safeMagnitude : safeMagnitude;

  const unsafe = Math.abs(kgPerWeek) > safeMagnitude + 1e-9;
  let safeDate: string | null = null;
  if (unsafe && safeMagnitude > 0) {
    const safeWeeks = Math.ceil(Math.abs(deltaKg) / safeMagnitude);
    safeDate = addDaysToDateString(todayStr, safeWeeks * 7);
  }

  return {
    kgPerWeek: Math.round(kgPerWeek * 100) / 100,
    kcalPerDay: kgPerWeekToKcal(kgPerWeek),
    weeks,
    verdict: unsafe ? (losing ? 'too-fast-loss' : 'too-fast-gain') : null,
    safeDate,
    safeKgPerWeek: Math.round(safeKgPerWeek * 100) / 100,
  };
}

/** Longest planning horizon the UI offers (2 years is a plan; 5 is a wish). */
export const TARGET_MAX_DAYS = 730;

function daysBetweenDates(a: string, b: string): number {
  return Math.round((dateFrom(b).getTime() - dateFrom(a).getTime()) / 86400000);
}

function addDaysToDateString(dateStr: string, days: number): string {
  const d = dateFrom(dateStr);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateFrom(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ─── Preset matching ───────────────────────────────────────────────────────────

/** Matches a stored kcal string to a preset key, or flags it as custom. */
export function matchPreset(kcalValue: string): { preset: GoalPresetKey | ""; isCustom: boolean } {
  const match = GOAL_PRESETS.find((p) => p.kcal === kcalValue);
  if (match) return { preset: match.key, isCustom: false };
  return { preset: "", isCustom: true };
}

// ─── Config ────────────────────────────────────────────────────────────────────

export const GOAL_PRESETS: GoalPreset[] = [
  { key: "lose-aggressive", shortLabel: "Max",         label: "Aggressive loss",          desc: "−1.00 kg/week — maximum recommended",  humanDesc: "Maximum rate — best suited for those with a significant amount to lose.", kgPerWeek: -1.00, kcal: String(kgPerWeekToKcal(-1.00)) },
  { key: "lose-fast",       shortLabel: "Fast",        label: "Lose weight faster",       desc: "−0.75 kg/week — aggressive pace",      humanDesc: "More aggressive than average — suits higher starting weights.",          kgPerWeek: -0.75, kcal: String(kgPerWeekToKcal(-0.75)) },
  { key: "lose-moderate",   shortLabel: "Recommended", label: "Lose weight",              desc: "−0.50 kg/week — recommended",          humanDesc: "A steady pace for most users.",                                          kgPerWeek: -0.50, kcal: String(kgPerWeekToKcal(-0.50)) },
  { key: "lose-slow",       shortLabel: "Gradual",     label: "Lose weight gradually",    desc: "−0.25 kg/week — gentle pace",          humanDesc: "Gentle and sustainable — good for preserving energy and muscle.",        kgPerWeek: -0.25, kcal: String(kgPerWeekToKcal(-0.25)) },
  { key: "lose-very-slow",  shortLabel: "Minimal",     label: "Minimal cut",              desc: "−0.10 kg/week — barely a deficit",     humanDesc: "A very light cut — minimal impact on energy levels.",                   kgPerWeek: -0.10, kcal: String(kgPerWeekToKcal(-0.10)) },
  { key: "maintain",        shortLabel: "Maintain",    label: "Maintain weight",          desc: "0 kg/week — no change",                humanDesc: "No deficit or surplus — keep your current weight.",                      kgPerWeek:  0.00, kcal: String(kgPerWeekToKcal( 0.00)) },
  { key: "gain",            shortLabel: "Gain",        label: "Gain weight",              desc: "+0.30 kg/week — modest surplus",       humanDesc: "A modest surplus to support gradual muscle growth.",                     kgPerWeek:  0.30, kcal: String(kgPerWeekToKcal( 0.30)) },
];
