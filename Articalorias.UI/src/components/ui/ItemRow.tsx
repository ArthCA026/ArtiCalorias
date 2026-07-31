import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useLongPress } from '@/hooks/useLongPress';

interface ItemRowProps {
  title: string;
  /** Right-aligned number on the title line, e.g. "320 kcal" */
  value?: ReactNode;
  ariaLabel: string;
  /** Marks templates that auto-add to each new day */
  autoBadge?: boolean;
  /** Tap or long-press anywhere on the row */
  onOpen: () => void;
  /** Right-most control (quick add etc.); pointer events do not bubble to the row */
  trailing?: ReactNode;
  /** One line under the title: amount chip + portion, duration, item count */
  meta?: ReactNode;
  /** Extra line under meta (e.g. the macro strip) */
  footer?: ReactNode;
}

/**
 * The one list row for meals, activities and routines, on Today and on Templates.
 * Anatomy: [title | value | trailing] / meta / footer.
 */
export function ItemRow({
  title,
  value,
  ariaLabel,
  autoBadge = false,
  onOpen,
  trailing,
  meta,
  footer,
}: ItemRowProps) {
  const handlers = useLongPress({ onLongPress: onOpen, onTap: onOpen });
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen();
      }}
      {...handlers}
      className="pressable w-full px-4 py-3 active:bg-press cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <span className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="text-[15px] font-bold text-ink truncate">{title}</span>
          {autoBadge && <Icon name="calendarCheck" size={14} className="text-primary shrink-0" />}
        </span>
        {value !== undefined && (
          <span className="shrink-0 text-[15px] font-extrabold text-ink tabular-nums">{value}</span>
        )}
        {trailing && (
          <span
            className="shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            {trailing}
          </span>
        )}
      </div>
      {meta && <div className="mt-1.5 flex items-center gap-1.5 min-w-0">{meta}</div>}
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}

/** Plain, non-interactive second line (Templates amounts, routine item counts). */
export function ItemMeta({ children }: { children: ReactNode }) {
  return <span className="text-[13px] text-ink-2 tabular-nums truncate">{children}</span>;
}
