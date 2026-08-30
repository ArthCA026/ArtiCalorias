import { useTranslation } from 'react-i18next';
import { MiniTable } from '@/components/ui/MiniTable';
import { g } from '@/utils/format';
import type { MacroKey } from '@/types';

/** One extra tracked macro on a row: null value = not captured on this item. */
export interface MacroStripExtra {
  key: MacroKey;
  value: number | null;
}

interface MacroStripProps {
  protein: number;
  fat: number;
  carbs: number;
  /**
   * Additional tracked macros (alcohol, sugar, water), appended after the
   * fixed three. Values are per-item; null renders as a dash so an old entry
   * from before tracking never fakes a zero.
   */
  extras?: MacroStripExtra[];
  /** Append "g" to each value (day totals); rows leave it off to stay compact */
  unit?: boolean;
  className?: string;
}

/**
 * PROT | FAT | CARBS (+ the user's other tracked macros) under a row. Owns
 * the labels so Today and Templates can never drift apart. The first three
 * are always there; the rest follow what the user tracks.
 */
export function MacroStrip({ protein, fat, carbs, extras = [], unit = false, className }: MacroStripProps) {
  const { t } = useTranslation();
  const v = (n: number) => (unit ? `${g(n)}g` : g(n));

  const extraLabel = (key: MacroKey): string => {
    switch (key) {
      case 'alcohol':
        return t('macros.alc_short', 'Alc');
      case 'sugar':
        return t('macros.sugar_short', 'Sugar');
      case 'water':
        return t('macros.water_short', 'Water');
      default:
        return key;
    }
  };

  return (
    <MiniTable
      className={className}
      cols={[
        { label: t('macros.prot', 'Prot'), value: v(protein) },
        { label: t('macros.fat', 'Fat'), value: v(fat) },
        { label: t('macros.carbs', 'Carbs'), value: v(carbs) },
        ...extras.map((x) => ({
          label: extraLabel(x.key),
          value: x.value === null ? '–' : v(x.value),
        })),
      ]}
    />
  );
}
