/**
 * Unit conversion and formatting utilities.
 *
 * The user picks one unit system: metric (kg, cm) or imperial (lbs, ft/in).
 * The backend always stores and receives SI values (kg, cm, kcal).
 * These helpers convert for display only — nothing here touches the API.
 * Energy is always kcal; both systems use it.
 *
 * Conversion factors:
 *   1 kg = 2.20462 lbs
 *   1 in = 2.54 cm, 1 ft = 12 in
 */

export type UnitSystem = "metric" | "imperial";
export type WeightUnit = "kg" | "lbs";

const KG_TO_LBS = 2.20462;
const CM_PER_INCH = 2.54;

/** The weight unit a system displays in. */
export function weightUnitFor(system: UnitSystem): WeightUnit {
  return system === "imperial" ? "lbs" : "kg";
}

// ─── Weight ───────────────────────────────────────────────────────────────────

/** Convert a stored kg value to the display unit. */
export function kgToDisplay(kg: number, unit: WeightUnit): number {
  return unit === "lbs" ? kg * KG_TO_LBS : kg;
}

/** Convert a user-entered display value back to kg for storage. */
export function displayToKg(value: number, unit: WeightUnit): number {
  return unit === "lbs" ? value / KG_TO_LBS : value;
}

/** Format a kg value with unit label: "68.0 kg" | "149.9 lbs" */
export function formatWeight(kg: number, unit: WeightUnit, decimals = 1): string {
  return `${kgToDisplay(kg, unit).toFixed(decimals)} ${weightLabel(unit)}`;
}

/**
 * Format a kg/week rate with sign: "−0.50 kg/wk" | "−1.10 lbs/wk"
 * Uses Unicode minus (−) not hyphen (-).
 */
export function formatWeightRate(kgPerWeek: number, unit: WeightUnit): string {
  const val = kgToDisplay(Math.abs(kgPerWeek), unit);
  const sign = kgPerWeek > 0 ? "+" : kgPerWeek < 0 ? "−" : "";
  const label = unit === "lbs" ? "lbs/wk" : "kg/wk";
  return kgPerWeek === 0 ? `0 ${label}` : `${sign}${val.toFixed(2)} ${label}`;
}

/** Long form rate: "−0.50 kg per week" | "−1.10 lbs per week" */
export function formatWeightRateLong(kgPerWeek: number, unit: WeightUnit): string {
  const val = kgToDisplay(Math.abs(kgPerWeek), unit);
  const sign = kgPerWeek > 0 ? "+" : kgPerWeek < 0 ? "−" : "";
  const label = unit === "lbs" ? "lbs per week" : "kg per week";
  return kgPerWeek === 0 ? `0 ${label}` : `${sign}${val.toFixed(2)} ${label}`;
}

/** Bare unit label for input fields and headers: "kg" | "lbs" */
export function weightLabel(unit: WeightUnit): string {
  return unit;
}

// ─── Height ───────────────────────────────────────────────────────────────────

/** Split a stored cm value into whole feet and rounded inches: 178 → 5 ft 10 in */
export function cmToFtIn(cm: number): { ft: number; inch: number } {
  const totalInches = Math.round(cm / CM_PER_INCH);
  let ft = Math.floor(totalInches / 12);
  let inch = totalInches % 12;
  // Rounding can land on 12 in; carry it into a full foot.
  if (inch === 12) {
    ft += 1;
    inch = 0;
  }
  return { ft, inch };
}

/** Convert user-entered feet + inches back to cm for storage. */
export function ftInToCm(ft: number, inch: number): number {
  return Math.round((ft * 12 + inch) * CM_PER_INCH * 10) / 10;
}

/** Format a stored cm height for display: "178 cm" | "5 ft 10 in" */
export function formatHeight(cm: number, system: UnitSystem): string {
  if (system === "imperial") {
    const { ft, inch } = cmToFtIn(cm);
    return `${ft} ft ${inch} in`;
  }
  return `${Math.round(cm)} cm`;
}
