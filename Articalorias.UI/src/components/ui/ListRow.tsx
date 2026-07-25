import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { Icon, type IconName } from './Icon';

interface ListRowProps {
  icon?: IconName;
  iconClassName?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-side accessory: value text, chevron, switch, button */
  right?: ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  className?: string;
  /** Extra gesture handlers (e.g. from useLongPress) */
  handlers?: Record<string, unknown>;
}

/** Standard settings/list row: icon bubble, title/subtitle, right accessory. */
export function ListRow({
  icon,
  iconClassName,
  title,
  subtitle,
  right,
  chevron,
  onClick,
  className,
  handlers,
}: ListRowProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      {...(handlers ?? {})}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 min-h-13 text-left',
        onClick && 'pressable active:bg-press',
        className,
      )}
    >
      {icon && (
        <span
          className={cn(
            'w-9 h-9 rounded-xl bg-inset text-ink-2 flex items-center justify-center shrink-0',
            iconClassName,
          )}
        >
          <Icon name={icon} size={18} />
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold text-ink truncate">{title}</span>
        {subtitle && <span className="block text-[13px] text-ink-2 mt-0.5">{subtitle}</span>}
      </span>
      {right && <span className="shrink-0 text-[15px] text-ink-2">{right}</span>}
      {chevron && <Icon name="chevronRight" size={18} className="text-ink-3 shrink-0" />}
    </Tag>
  );
}
