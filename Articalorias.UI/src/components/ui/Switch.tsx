import { cn } from '@/utils/cn';
import { useHaptics } from '@/hooks/useHaptics';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}

/** Accessible toggle switch with haptic feedback. */
export function Switch({ checked, onChange, disabled, label }: SwitchProps) {
  const haptics = useHaptics();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        haptics.tap();
        onChange(!checked);
      }}
      className={cn(
        'relative w-12.5 h-7.5 rounded-full transition-colors duration-200 shrink-0',
        checked ? 'bg-primary' : 'bg-press',
        disabled && 'opacity-50 pointer-events-none',
      )}
    >
      <span
        className={cn(
          'absolute top-0.75 left-0.75 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200',
          checked && 'translate-x-5',
        )}
      />
    </button>
  );
}
