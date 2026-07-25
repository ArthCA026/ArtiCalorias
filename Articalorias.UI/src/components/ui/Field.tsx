import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { InlineError } from './States';
import { IconButton } from './Button';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  /** Right-side adornment inside the input (unit label, icon button) */
  suffix?: ReactNode;
  containerClassName?: string;
}

/**
 * Text field on an inset well. 16px font prevents iOS zoom.
 * Pass the correct keyboard per content: inputMode="decimal" for
 * weights/macros, "numeric" for ages/codes, type="email" for emails.
 */
export function Field({
  label,
  hint,
  error,
  suffix,
  className,
  containerClassName,
  id,
  ...rest
}: FieldProps) {
  const inputId = id ?? (label ? `f-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  return (
    <div className={containerClassName}>
      {label && (
        <label htmlFor={inputId} className="block text-[13px] font-semibold text-ink-2 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          className={cn(
            'w-full h-12 px-4 rounded-control bg-inset text-ink text-base',
            'placeholder:text-ink-3',
            error ? 'ring-2 ring-danger/50' : undefined,
            suffix ? 'pr-14' : undefined,
            className,
          )}
          {...rest}
        />
        {suffix && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-3">
            {suffix}
          </div>
        )}
      </div>
      {error ? (
        <InlineError message={error} />
      ) : hint ? (
        <p className="text-[13px] text-ink-3 mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
}

interface PasswordFieldProps extends Omit<FieldProps, 'type' | 'suffix'> {
  showLabel: string;
  hideLabel: string;
}

export function PasswordField({ showLabel, hideLabel, ...rest }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...rest}
      type={visible ? 'text' : 'password'}
      suffix={
        <IconButton
          icon={visible ? 'eyeOff' : 'eye'}
          label={visible ? hideLabel : showLabel}
          size={36}
          iconSize={18}
          onClick={() => setVisible((v) => !v)}
        />
      }
    />
  );
}

/**
 * Decimal input safe for iOS: type=text + inputMode=decimal,
 * comma normalized to dot.
 */
export function DecimalField(props: Omit<FieldProps, 'type' | 'inputMode' | 'onChange'> & {
  onValueChange: (raw: string) => void;
}) {
  const { onValueChange, ...rest } = props;
  return (
    <Field
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      onChange={(e) => onValueChange(e.target.value.replace(',', '.'))}
    />
  );
}
