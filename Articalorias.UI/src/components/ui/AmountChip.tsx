import { Icon } from '@/components/ui/Icon';

interface AmountChipProps {
  /** What the chip reads, e.g. "2" or "30 min" */
  label: string;
  ariaLabel: string;
  onEdit: () => void;
}

/**
 * Tappable amount pill inside a row: quantity on meals, duration on activities.
 * Sits on a row that is itself tappable, so it stops its own pointer events.
 */
export function AmountChip({ label, ariaLabel, onEdit }: AmountChipProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onEdit();
      }}
      className="pressable shrink-0 inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-inset active:bg-press text-[13px] font-semibold text-ink-2 tabular-nums"
    >
      {label}
      <Icon name="chevronDown" size={13} className="text-ink-3 shrink-0" />
    </button>
  );
}
