/**
 * Unit conversion and formatting utilities.
 *
 * The backend always stores and receives SI values (kg, kcal).
 * These helpers convert for display only — nothing here touches the API.
 *
 * Conversion factors:
 *   1 kg  = 2.20462 lbs
 *   1 kcal = 4.184 kJ
 */

export type WeightUnit = "kg" | "lbs";
export type EnergyUnit = "kcal" | "kJ";

const KG_TO_LBS = 2.20462;
const KCAL_TO_KJ = 4.184;

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
  const sign = kgPerWeek > 0 ? "+" : kgPerWeek < 0 ? "\u2212" : "";
  const label = unit === "lbs" ? "lbs/wk" : "kg/wk";
  return kgPerWeek === 0 ? `0 ${label}` : `${sign}${val.toFixed(2)} ${label}`;
}

/** Long form rate: "−0.50 kg per week" | "−1.10 lbs per week" */
export function formatWeightRateLong(kgPerWeek: number, unit: WeightUnit): string {
  const val = kgToDisplay(Math.abs(kgPerWeek), unit);
  const sign = kgPerWeek > 0 ? "+" : kgPerWeek < 0 ? "\u2212" : "";
  const label = unit === "lbs" ? "lbs per week" : "kg per week";
  return kgPerWeek === 0 ? `0 ${label}` : `${sign}${val.toFixed(2)} ${label}`;
}

/** Bare unit label for input fields and headers: "kg" | "lbs" */
export function weightLabel(unit: WeightUnit): string {
  return unit;
}

// ─── Energy ───────────────────────────────────────────────────────────────────

/** Convert a stored kcal value to the display unit. */
export function kcalToDisplay(kcal: number, unit: EnergyUnit): number {
  return unit === "kJ" ? kcal * KCAL_TO_KJ : kcal;
}

/** Convert a user-entered display value back to kcal for storage. */
export function displayToKcal(value: number, unit: EnergyUnit): number {
  return unit === "kJ" ? value / KCAL_TO_KJ : value;
}

/**
 * Format a kcal value for display: "1,500 kcal" | "6,276 kJ"
 * Uses locale number formatting with thousand separators.
 */
export function formatEnergy(kcal: number, unit: EnergyUnit, decimals = 0): string {
  const val = kcalToDisplay(kcal, unit);
  return `${val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${energyLabel(unit)}`;
}

/** Format a kcal/day rate: "1,500 kcal/day" | "6,276 kJ/day" */
export function formatEnergyRate(kcal: number, unit: EnergyUnit): string {
  const val = kcalToDisplay(kcal, unit);
  const label = unit === "kJ" ? "kJ/day" : "kcal/day";
  return `${val.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${label}`;
}

/**
 * Format a kcal adjustment with sign, rounded to nearest 10.
 * "about +330 kcal/day" | "about +1,381 kJ/day"
 */
export function formatEnergyAdjustment(kcal: number, unit: EnergyUnit): string {
  if (kcal === 0) return unit === "kJ" ? "no energy adjustment" : "no calorie adjustment";
  const displayVal = kcalToDisplay(kcal, unit);
  const rounded = Math.round(displayVal / (unit === "kJ" ? 40 : 10)) * (unit === "kJ" ? 40 : 10);
  const sign = rounded > 0 ? "+" : "\u2212";
  const label = unit === "kJ" ? "kJ/day" : "kcal/day";
  return `about ${sign}${Math.abs(rounded).toLocaleString()} ${label}`;
}

/** Bare unit label: "kcal" | "kJ" */
export function energyLabel(unit: EnergyUnit): string {
  return unit;
}

/** Rate label: "kcal/day" | "kJ/day" */
export function energyRateLabel(unit: EnergyUnit): string {
  return unit === "kJ" ? "kJ/day" : "kcal/day";
}
