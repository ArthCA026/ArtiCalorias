import { useRef } from "react";
import type { KeyboardEvent, ClipboardEvent, ChangeEvent, FocusEvent } from "react";

interface SegmentedCodeInputProps {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  error?: string | null;
  showError?: boolean;
  helperText?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
}

export default function SegmentedCodeInput({
  id,
  label = "Reset code",
  value,
  onChange,
  length = 6,
  disabled = false,
  error = null,
  showError = false,
  helperText,
  autoFocus = false,
  onBlur,
}: SegmentedCodeInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] || "");
  const hasError = !!(showError && error);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const descId = hasError ? errorId : helperText ? hintId : undefined;
  const activeIndex = Math.min(value.length, length - 1);

  function focusBox(i: number) {
    inputRefs.current[Math.max(0, Math.min(i, length - 1))]?.focus();
  }

  function handleChange(index: number, e: ChangeEvent<HTMLInputElement>) {
    const char = e.target.value.replace(/\D/g, "").slice(-1);
    if (!char) return;

    let next: string;
    if (index < value.length) {
      next = value.slice(0, index) + char + value.slice(index + 1);
    } else if (index === value.length) {
      next = value + char;
    } else {
      return;
    }

    onChange(next.slice(0, length));
    if (index < length - 1) focusBox(index + 1);
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "Backspace":
        e.preventDefault();
        if (index < value.length && digits[index]) {
          onChange(value.slice(0, index) + value.slice(index + 1));
        } else if (index > 0) {
          onChange(value.slice(0, index - 1) + value.slice(index));
          focusBox(index - 1);
        }
        break;
      case "Delete":
        e.preventDefault();
        if (index < value.length) {
          onChange(value.slice(0, index) + value.slice(index + 1));
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (index > 0) focusBox(index - 1);
        break;
      case "ArrowRight":
        e.preventDefault();
        if (index < length - 1) focusBox(index + 1);
        break;
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    focusBox(Math.min(pasted.length, length - 1));
  }

  function handleFocus(index: number, e: FocusEvent<HTMLInputElement>) {
    const firstEmpty = Math.min(value.length, length - 1);
    if (index > firstEmpty) {
      focusBox(firstEmpty);
      return;
    }
    e.target.select();
  }

  function handleBlur(e: FocusEvent<HTMLInputElement>) {
    const next = e.relatedTarget as HTMLElement | null;
    const isInternal = inputRefs.current.some((ref) => ref === next);
    if (!isInternal && onBlur) onBlur();
  }

  return (
    <div>
      {label && (
        <label id={`${id}-label`} className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}

      <div
        className="flex gap-2 justify-center"
        role="group"
        aria-labelledby={label ? `${id}-label` : undefined}
        aria-describedby={descId}
      >
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            id={i === 0 ? id : `${id}-${i}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            value={digit}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={(e) => handleFocus(i, e)}
            onBlur={handleBlur}
            disabled={disabled}
            autoFocus={autoFocus && i === 0}
            tabIndex={i === activeIndex ? 0 : -1}
            aria-label={`Digit ${i + 1} of ${length}`}
            aria-invalid={hasError ? "true" : undefined}
            aria-describedby={descId}
            className={`h-12 w-12 rounded-md border text-center text-xl font-mono font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 transition-colors disabled:opacity-50 disabled:bg-gray-50 ${
              hasError
                ? "border-red-400 focus:border-red-500 focus:ring-red-500/30"
                : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500/30"
            }`}
          />
        ))}
      </div>

      {hasError ? (
        <p id={errorId} className="mt-2 text-center text-sm text-red-600" role="alert">{error}</p>
      ) : helperText ? (
        <p id={hintId} className="mt-2 text-center text-xs text-gray-400">{helperText}</p>
      ) : null}
    </div>
  );
}
