import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useLongPress } from '@/hooks/useLongPress';

interface TemplateRowProps {
  title: string;
  subtitle: string;
  ariaLabel: string;
  /** Marks templates that auto-add to each new day */
  autoBadge?: boolean;
  /** Tap or long-press anywhere on the row */
  onOpen: () => void;
  /** Right-side control (quick add button etc.); pointer events do not bubble to the row */
  trailing: ReactNode;
}

/** Shared list row for the Templates screen: tap or long-press opens options. */
export function TemplateRow({ title, subtitle, ariaLabel, autoBadge = false, onOpen, trailing }: TemplateRowProps) {
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
      className="pressable w-full flex items-center gap-3 px-4 py-3 active:bg-press cursor-pointer"
    >
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-[15px] font-semibold text-ink truncate">{title}</span>
          {autoBadge && <Icon name="calendarCheck" size={14} className="text-primary shrink-0" />}
        </span>
        <span className="block text-[13px] text-ink-2 mt-0.5 truncate">{subtitle}</span>
      </span>
      <span
        className="shrink-0"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        {trailing}
      </span>
    </div>
  );
}
