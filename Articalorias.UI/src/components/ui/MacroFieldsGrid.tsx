import type { ReactNode } from 'react';
import { DecimalField } from '@/components/ui/Field';
import { useMacros } from '@/hooks/useMacros';
import { macroUnitSuffix } from '@/utils/macros';
import { cn } from '@/utils/cn';

interface MacroFieldsGridProps {
  /** Macro keys to render, in the order given (use sortKeysByCatalog). */
  keys: string[];
  /** Raw field strings keyed by macro key ('' = blank). */
  values: Record<string, string>;
  onChange: (key: string, raw: string) => void;
  /** Rendered first inside the grid (the Calories field usually lives here). */
  leading?: ReactNode;
  placeholder?: string;
  className?: string;
}

/**
 * The one macro form: a two-column grid of decimal fields, one per macro,
 * labeled and suffixed from the catalog. Used by the meal edit sheet, manual
 * entry and the template sheet so a new macro shows up in all three at once.
 */
export function MacroFieldsGrid({ keys, values, onChange, leading, placeholder = '0', className }: MacroFieldsGridProps) {
  const { get, label } = useMacros();
  return (
    <div className={cn('grid grid-cols-2 gap-3', className)}>
      {leading}
      {keys.map((key) => {
        const def = get(key);
        return (
          <DecimalField
            key={key}
            label={label(def)}
            suffix={macroUnitSuffix(def)}
            placeholder={placeholder}
            value={values[key] ?? ''}
            onValueChange={(raw) => onChange(key, raw)}
          />
        );
      })}
    </div>
  );
}
