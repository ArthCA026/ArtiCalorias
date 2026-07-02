import { DecimalInput } from '@/components/DecimalInput';

const inputClass =
  'w-full rounded-md border border-input-border bg-input-bg text-fg-primary px-2.5 py-1.5 text-sm placeholder:text-fg-subtle focus:border-accent-soft focus:ring-1 focus:ring-accent-soft focus:outline-none';

/** Label for use inside modal forms. */
export function ModalLabel({ htmlFor, text }: { htmlFor?: string; text: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-fg-secondary mb-1">
      {text}
    </label>
  );
}

interface ModalTextInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
}

/** Single-line text input for use inside modal forms. */
export function ModalTextInput({ id, value, onChange, placeholder, required, maxLength }: ModalTextInputProps) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      maxLength={maxLength}
      className={inputClass}
    />
  );
}

interface ModalNumberInputProps {
  id: string;
  value: number | '';
  onChange: (value: number | '') => void;
  min?: string;
  max?: string;
  placeholder?: string;
}

/** Decimal number input for use inside modal forms. */
export function ModalNumberInput({ id, value, onChange, min, max, placeholder }: ModalNumberInputProps) {
  return (
    <DecimalInput
      id={id}
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      placeholder={placeholder}
      className={`${inputClass} text-right`}
    />
  );
}
