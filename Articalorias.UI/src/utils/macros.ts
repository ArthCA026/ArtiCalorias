import type { TFunction } from 'i18next';
import type { IconName } from '@/components/ui/Icon';
import type { DailyLogResponse, DayMacroTarget, MacroKey } from '@/types';

/**
 * The one place a macro key turns into a face: icon, color token, unit and
 * name. Every bar, chip and settings row reads from here so the same macro
 * can never look different on two screens.
 */
export const MACRO_META: Record<
  MacroKey,
  { icon: IconName; color: string; unit: 'g' | 'ml'; labelKey: string; fallback: string }
> = {
  carbs: { icon: 'wheat', color: 'var(--t-carbs)', unit: 'g', labelKey: 'macros.carbs_full', fallback: 'Carbs' },
  fat: { icon: 'droplet', color: 'var(--t-fat)', unit: 'g', labelKey: 'macros.fat_full', fallback: 'Fat' },
  alcohol: { icon: 'wine', color: 'var(--t-alcohol)', unit: 'g', labelKey: 'macros.alcohol_full', fallback: 'Alcohol' },
  sugar: { icon: 'candy', color: 'var(--t-sugar)', unit: 'g', labelKey: 'macros.sugar_full', fallback: 'Sugar' },
  water: { icon: 'glassWater', color: 'var(--t-water)', unit: 'ml', labelKey: 'macros.water_full', fallback: 'Water' },
};

/**
 * Protein's face. It is not a MacroKey (its goal lives on the profile with its
 * own snapshot pipeline) but it renders in the same bar grid as the others,
 * so its icon and color are defined once, here, next to them.
 */
export const PROTEIN_META = {
  icon: 'drumstick' as IconName,
  color: 'var(--t-protein)',
  unit: 'g' as const,
  labelKey: 'today.protein',
  fallback: 'Protein',
};

export function macroLabel(t: TFunction, key: MacroKey): string {
  return t(MACRO_META[key].labelKey, MACRO_META[key].fallback);
}

/**
 * The day's consumed amount for a macro. Null only when the day genuinely has
 * no data for it (sugar/water before the user tracked them); a day whose
 * frozen targets include the macro reads null as an honest 0.
 */
export function macroTotalFor(log: DailyLogResponse, key: MacroKey): number | null {
  switch (key) {
    case 'carbs':
      return log.totalCarbsGrams;
    case 'fat':
      return log.totalFatGrams;
    case 'alcohol':
      return log.totalAlcoholGrams;
    case 'sugar':
      return log.totalSugarGrams;
    case 'water':
      return log.totalWaterMl;
  }
}

/** Formats an amount in the macro's unit: "35g" | "1,250 ml". */
export function formatMacroAmount(key: MacroKey, value: number): string {
  const rounded = Math.round(value);
  return MACRO_META[key].unit === 'ml' ? `${rounded.toLocaleString()} ml` : `${rounded}g`;
}

/** The day's frozen target entry for a macro, if it was tracked that day. */
export function dayTargetFor(log: DailyLogResponse, key: MacroKey): DayMacroTarget | undefined {
  return log.macroTargets.find((m) => m.macroKey === key);
}
