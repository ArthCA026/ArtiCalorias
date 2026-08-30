import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useLongPress } from '@/hooks/useLongPress';
import { cn } from '@/utils/cn';

interface ItemRowProps {
  title: string;
  /** Right-aligned number on the title line, e.g. "320 kcal" */
  value?: ReactNode;
  ariaLabel: string;
  /** Marks templates that auto-add to each new day */
  autoBadge?: boolean;
  /** Tap anywhere on the row (open/edit; toggle while selecting) */
  onTap: () => void;
  /** Hold the row (enters multi-select). Falls back to onTap when omitted. */
  onLongPress?: () => void;
  /** Multi-select mode: shows a leading check circle, hides trailing controls */
  selectMode?: boolean;
  selected?: boolean;
  /** Right-most control (quick add etc.); pointer events do not bubble to the row */
  trailing?: ReactNode;
  /** One line under the title: amount chip + portion, duration, item count */
  meta?: ReactNode;
  /** Extra line under meta (e.g. the macro strip) */
  footer?: ReactNode;
}

/**
 * The one list row for meals, activities and routines, on Today and on Templates.
 * Anatomy: [select-check?] [title | value | trailing] / meta / footer.
 * One tap opens the item; holding it starts multi-select, after which taps
 * toggle. In select mode the trailing control hides so a toggle can never be
 * mistaken for a quick action.
 */
export function ItemRow({
  title,
  value,
  ariaLabel,
  autoBadge = false,
  onTap,
  onLongPress,
  selectMode = false,
  selected = false,
  trailing,
  meta,
  footer,
}: ItemRowProps) {
  const handlers = useLongPress({ onLongPress: onLongPress ?? onTap, onTap });
  return (
    <div
      role={selectMode ? 'checkbox' : 'button'}
      aria-checked={selectMode ? selected : undefined}
      tabIndex={0}
      aria-label={ariaLabel}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onTap();
      }}
      {...handlers}
      className={cn(
        'pressable w-full px-4 py-3 active:bg-press cursor-pointer',
        selectMode && selected && 'bg-primary-soft/60',
      )}
    >
      <div className="flex items-center gap-3">
        {selectMode && (
          <span
            aria-hidden="true"
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
              selected ? 'bg-primary border-primary text-on-primary' : 'border-ink-3/50 text-transparent',
            )}
          >
            <Icon name="check" size={14} strokeWidth={3} />
          </span>
        )}
        <span className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="text-[15px] font-bold text-ink truncate">{title}</span>
          {autoBadge && <Icon name="calendarCheck" size={14} className="text-primary shrink-0" />}
        </span>
        {value !== undefined && (
          <span className="shrink-0 text-[15px] font-extrabold text-ink tabular-nums">{value}</span>
        )}
        {trailing && !selectMode && (
          <span
            className="shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            {trailing}
          </span>
        )}
      </div>
      {meta && (
        <div className={cn('mt-1.5 flex items-center gap-1.5 min-w-0', selectMode && 'pl-9')}>
          {meta}
        </div>
      )}
      {footer && <div className={cn('mt-2', selectMode && 'pl-9')}>{footer}</div>}
    </div>
  );
}

/** Plain, non-interactive second line (Templates amounts, routine item counts). */
export function ItemMeta({ children }: { children: ReactNode }) {
  return <span className="text-[13px] text-ink-2 tabular-nums truncate">{children}</span>;
}
