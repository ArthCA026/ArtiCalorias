import { cn } from '@/utils/cn';

export interface MiniTableCol {
  label: string;
  value: string;
}

/** From this many columns on the cells tighten, so a full set still tends to fit one line. */
const DENSE_FROM = 5;

/**
 * Compact label-over-value table used under meal and template rows:
 * PROT | FAT | CARBS
 * 18.9 | 14.4 | 1.2
 *
 * It can never be wider than its row. Columns keep their natural width and
 * flow onto a second line when the row runs out (a narrow phone, a long
 * label, select mode indenting the row, or an old day frozen with more
 * tracked macros than today's limit allows). Every cell draws its divider on
 * the LEFT and the whole strip is pulled left by one cell padding inside a
 * clipping box, so the first divider of EVERY line lands outside the box:
 * wrapped lines start flush with the first one and no divider ever dangles
 * at a line start.
 */
export function MiniTable({ cols, className }: { cols: MiniTableCol[]; className?: string }) {
  const dense = cols.length >= DENSE_FROM;
  return (
    <div className={cn('overflow-hidden', className)}>
      <div className={cn('flex flex-wrap items-stretch gap-y-2', dense ? '-ml-2' : '-ml-3')}>
        {cols.map((c) => (
          <div
            key={c.label}
            className={cn(
              'flex min-w-0 max-w-full flex-col items-center border-l border-hairline/60',
              dense ? 'px-2' : 'px-3',
            )}
          >
            <span className="max-w-full truncate text-[10px] font-bold uppercase tracking-wide text-ink-3">
              {c.label}
            </span>
            <span className="mt-0.5 max-w-full truncate text-[13px] font-semibold text-ink tabular-nums">
              {c.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
