import { IconButton } from './Button';
import { cn } from '@/utils/cn';

interface StepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
  decreaseLabel: string;
  increaseLabel: string;
  className?: string;
}

/** Quantity stepper: two big touch targets beat free typing for small edits. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  format,
  decreaseLabel,
  increaseLabel,
  className,
}: StepperProps) {
  const dec = () => onChange(Math.max(min, Math.round((value - step) * 1000) / 1000));
  const inc = () => onChange(Math.min(max, Math.round((value + step) * 1000) / 1000));
  return (
    <div className={cn('inline-flex items-center gap-1 bg-inset rounded-control p-1', className)}>
      <IconButton icon="minus" label={decreaseLabel} size={38} iconSize={17} variant="inset" onClick={dec} />
      <span className="min-w-11 text-center text-[15px] font-bold text-ink tabular-nums">
        {format ? format(value) : value}
      </span>
      <IconButton icon="plus" label={increaseLabel} size={38} iconSize={17} variant="inset" onClick={inc} />
    </div>
  );
}
