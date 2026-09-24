import { MiniTable } from '@/components/ui/MiniTable';
import { useMacros } from '@/hooks/useMacros';
import { formatMacroAmount, type MacroStripItem } from '@/utils/macros';
import { g } from '@/utils/format';

interface MacroStripProps {
  /**
   * Which macros to show, in order, with per-item values. Build it with
   * rowStripItems() (rows: tracked macros only) or dayTotalsItems() (the
   * day's totals). A null value renders as a dash so an old entry from
   * before tracking never fakes a zero. Callers skip the strip entirely when
   * the list is empty.
   */
  items: MacroStripItem[];
  /** Append the unit to each value (day totals); rows leave it off to stay compact */
  unit?: boolean;
  className?: string;
}

/**
 * The tracked macros under a row (PROT | FIBER | SODIUM ...). Labels and
 * units come from the catalog, so Today and Templates can never drift apart
 * and a new macro needs no change here. However many there are, the strip
 * wraps inside its row instead of overflowing it (see MiniTable).
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
