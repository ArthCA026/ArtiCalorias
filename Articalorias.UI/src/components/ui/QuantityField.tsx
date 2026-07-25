import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton, Button } from './Button';
import { Sheet } from './Sheet';
import { cn } from '@/utils/cn';

/**
 * Amount control that combines steppers with direct typing.
 * Decimals are allowed (comma or dot), so going from 1 to 100 or to 2.5
 * is one short edit instead of a hundred taps.
 */

const fmtNum = (n: number): string => {
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded);
};

interface QuantityFieldProps {
  value: number;
  onCommit: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  autoFocus?: boolean;
  className?: string;
}

export function QuantityField({
  value,
  onCommit,
  min = 0,
  max = 100000,
  step = 1,
  suffix,
  autoFocus,
  className,
}: QuantityFieldProps) {
  const { t } = useTranslation();
  const [text, setText] = useState(fmtNum(value));
  const [prevValue, setPrevValue] = useState(value);

  // Adjust-state-during-render: resync the text when the outside value changes
  if (prevValue !== value) {
    setPrevValue(value);
    setText(fmtNum(value));
  }

  const parse = (raw: string): number | null => {
    if (raw.trim() === '') return null;
    const n = Number(raw.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };

  const commit = (n: number) => {
    const clamped = Math.min(max, Math.max(min, Math.round(n * 1000) / 1000));
    setText(fmtNum(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  const current = () => parse(text) ?? value;

  return (
    <div className={cn('inline-flex items-center gap-1 bg-inset rounded-control p-1', className)}>
      <IconButton
        icon="minus"
        label={t('common.decrease', 'Decrease')}
        size={40}
        iconSize={17}
        variant="inset"
        onClick={() => commit(current() - step)}
      />
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        value={text}
        aria-label={t('common.amount', 'Amount')}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = parse(text);
          if (n === null) setText(fmtNum(value));
          else commit(n);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className="w-16 bg-transparent text-center text-base font-bold text-ink tabular-nums"
      />
      {suffix && <span className="text-[13px] font-medium text-ink-3 pr-1">{suffix}</span>}
      <IconButton
        icon="plus"
        label={t('common.increase', 'Increase')}
        size={40}
        iconSize={17}
        variant="inset"
        onClick={() => commit(current() + step)}
      />
    </div>
  );
}

interface QuickAmountSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Context line, e.g. the item name */
  subtitle?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  saving?: boolean;
  onSave: (next: number) => void;
}

/**
 * One-tap amount editor: opened from a quantity or duration chip,
 * changes just that number, saves, done.
 */
export function QuickAmountSheet({
  open,
  onClose,
  title,
  subtitle,
  value,
  min = 0,
  max = 100000,
  step = 1,
  suffix,
  saving = false,
  onSave,
}: QuickAmountSheetProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);
  const [prevOpen, setPrevOpen] = useState(open);

  // Reset the draft each time the sheet opens
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setDraft(value);
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {subtitle && <p className="text-[13px] text-ink-2 -mt-1 mb-3 truncate">{subtitle}</p>}
      <div className="flex justify-center py-2">
        <QuantityField
          value={draft}
          onCommit={setDraft}
          min={min}
          max={max}
          step={step}
          suffix={suffix}
          autoFocus
        />
      </div>
      <Button
        variant="primary"
        size="lg"
        fullWidth
        className="mt-4"
        loading={saving}
        onClick={() => onSave(draft)}
      >
        {t('common.save', 'Save')}
      </Button>
    </Sheet>
  );
}
