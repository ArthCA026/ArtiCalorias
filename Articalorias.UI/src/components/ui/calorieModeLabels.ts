import type { TFunction } from 'i18next';
import type { CalorieMode } from '@/hooks/useCalorieMode';

/**
 * The names of the three calorie display modes, in one place.
 *
 * Kept out of the component file so importing a label never drags a component
 * in, and so the Profile row, the picker sheet and every mode tag can never
 * drift apart in wording again.
 */

/** Chip-sized name: "Weekly" / "Daily" / "Net". */
export function calorieModeShortLabel(t: TFunction, mode: CalorieMode): string {
  switch (mode) {
    case 'goal':
      return t('profile.mode_goal_short', 'Daily');
    case 'net':
      return t('profile.mode_net_short', 'Net');
    case 'adjusted':
    default:
      return t('profile.mode_adjusted_short', 'Weekly');
  }
}

/** Full name, for the picker and for assistive tech: "Weekly adjusted". */
export function calorieModeTitle(t: TFunction, mode: CalorieMode): string {
  switch (mode) {
    case 'goal':
      return t('profile.mode_goal', 'Fixed daily goal');
    case 'net':
      return t('profile.mode_net', 'Net balance');
    case 'adjusted':
    default:
      return t('profile.mode_adjusted', 'Weekly adjusted');
  }
}
