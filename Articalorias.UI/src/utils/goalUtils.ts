/**
 * Goal-selection utilities: types, config, and pure conversion/formatting helpers.
 * These are kept here so they can be imported by both GoalSelector sub-components
 * and any future pages that need to reason about goal values.
 */

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

/** Formats a kg/week value with the correct sign character (−, not hyphen). */
export function formatKgPerWeek(kg: number): string {
  if (kg === 0) return "0 kg per week";
  const sign = kg > 0 ? "+" : "−";
  return `${sign}${Math.abs(kg).toFixed(2)} kg per week`;
}

/** Formats a daily kcal adjustment rounded to the nearest 10. */
export function formatKcalAdjustment(kcal: number): string {
  if (kcal === 0) return "no calorie adjustment";
  const rounded = Math.round(kcal / 10) * 10;
  const sign = rounded > 0 ? "+" : "−";
  return `about ${sign}${Math.abs(rounded).toLocaleString()} kcal/day`;
}

// ─── Validation helpers ────────────────────────────────────────────────────────

/** Allowed range for the custom weekly weight-change target. */
export const CUSTOM_KG_MIN = -1.50;
export const CUSTOM_KG_MAX =  1.00;

/** Validates a raw custom kg/week string. Returns an error message or null. */
export function validateCustomKg(value: string): string | null {
  if (!value.trim()) return "Enter a value.";
  const n = parseFloat(value);
  if (isNaN(n)) return "Enter a valid number.";
  if (n < CUSTOM_KG_MIN) return `Minimum is ${CUSTOM_KG_MIN} kg/week.`;
  if (n > CUSTOM_KG_MAX) return `Maximum is +${CUSTOM_KG_MAX} kg/week.`;
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
