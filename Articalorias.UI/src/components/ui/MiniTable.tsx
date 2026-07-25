import { cn } from '@/utils/cn';

export interface MiniTableCol {
  label: string;
  value: string;
}

/**
 * Compact label-over-value table used under meal and template rows:
 * PROT | FAT | CARBS
 * 18.9 | 14.4 | 1.2
 */
export function MiniTable({ cols, className }: { cols: MiniTableCol[]; className?: string }) {
  return (
    <div className={cn('flex items-stretch', className)}>
      {cols.map((c, i) => (
        <div
          key={c.label}
          className={cn(
            'flex flex-col items-center px-3 first:pl-0',
            i > 0 && 'border-l border-hairline/60',
          )}
        >
          <span className="text-[10px] font-bold uppercase tracking-wide text-ink-3">{c.label}</span>
          <span className="text-[13px] font-semibold text-ink tabular-nums mt-0.5">{c.value}</span>
        </div>
      ))}
    </div>
  );
}
