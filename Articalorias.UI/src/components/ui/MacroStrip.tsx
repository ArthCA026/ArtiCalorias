import { useTranslation } from 'react-i18next';
import { MiniTable } from '@/components/ui/MiniTable';
import { g } from '@/utils/format';

interface MacroStripProps {
  protein: number;
  fat: number;
  carbs: number;
  /** Append "g" to each value (day totals); rows leave it off to stay compact */
  unit?: boolean;
  className?: string;
}

/**
 * PROT | FAT | CARBS under a row. Owns the three labels so Today and Templates
 * can never drift apart.
 */
export function MacroStrip({ protein, fat, carbs, unit = false, className }: MacroStripProps) {
  const { t } = useTranslation();
  const v = (n: number) => (unit ? `${g(n)}g` : g(n));
  return (
    <MiniTable
      className={className}
      cols={[
        { label: t('macros.prot', 'Prot'), value: v(protein) },
        { label: t('macros.fat', 'Fat'), value: v(fat) },
        { label: t('macros.carbs', 'Carbs'), value: v(carbs) },
      ]}
    />
  );
}
