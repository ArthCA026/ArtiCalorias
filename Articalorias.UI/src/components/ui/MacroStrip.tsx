import { MiniTable } from '@/components/ui/MiniTable';
import { useMacros } from '@/hooks/useMacros';
import { formatMacroAmount, type MacroStripItem } from '@/utils/macros';
import { g } from '@/utils/format';

interface MacroStripProps {
  /**
   * Which macros to show, in order, with per-item values. Build it with
   * rowStripItems(): the "always" macros plus whatever the day or the user
   * tracks. A null value renders as a dash so an old entry from before
   * tracking never fakes a zero.
   */
  items: MacroStripItem[];
  /** Append the unit to each value (day totals); rows leave it off to stay compact */
  unit?: boolean;
  className?: string;
}

/**
 * PROT | FAT | CARBS (+ the user's other tracked macros) under a row. Labels
 * and units come from the catalog, so Today and Templates can never drift
 * apart and a new macro needs no change here.
 */
export function MacroStrip({ items, unit = false, className }: MacroStripProps) {
  const { get, label } = useMacros();

  const format = (key: string, value: number) => {
    const def = get(key);
    if (unit) return formatMacroAmount(def, value);
    return def.unit === 'g' ? g(value) : Math.round(value).toLocaleString();
  };

  return (
    <MiniTable
      className={className}
      cols={items.map((item) => ({
        label: label(item.key, 'shortName'),
        value: item.value === null ? '–' : format(item.key, item.value),
      }))}
    />
  );
}
