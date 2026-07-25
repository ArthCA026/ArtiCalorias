import { cn } from '@/utils/cn';
import { Icon, type IconName } from './Icon';
import { useHaptics } from '@/hooks/useHaptics';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  'aria-label'?: string;
}

/** iOS-style segmented control on an inset track. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  const haptics = useHaptics();
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('flex bg-inset rounded-control p-1 gap-1', className)}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => {
              if (!selected) {
                haptics.tap();
                onChange(opt.value);
              }
            }}
            className={cn(
              'pressable flex-1 h-9.5 rounded-[10px] inline-flex items-center justify-center gap-1.5',
              'text-sm font-semibold transition-colors',
              selected ? 'bg-card text-ink shadow-sm' : 'text-ink-2',
            )}
          >
            {opt.icon && <Icon name={opt.icon} size={16} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
