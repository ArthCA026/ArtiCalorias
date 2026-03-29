import type { ClipboardEvent, ReactNode } from "react";

interface FormFieldProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onPaste?: (e: ClipboardEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  inputMode?: "none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url";
  placeholder?: string;
  error: string | null;
  showError: boolean;
  hint?: string;
  labelRight?: ReactNode;
  inputClassName?: string;
}

export default function FormField({
  id,
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  onPaste,
  autoComplete,
  inputMode,
  placeholder,
  error,
  showError,
  hint,
  labelRight,
  inputClassName = "",
}: FormFieldProps) {
  const hasError = !!(showError && error);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div>
      <div className={labelRight ? "flex items-center justify-between" : undefined}>
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
        {labelRight}
      </div>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onPaste={onPaste}
        aria-invalid={hasError ? "true" : undefined}
        aria-describedby={hasError ? errorId : hint ? hintId : undefined}
        className={`mt-1 block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${hasError ? "border-red-400 focus:border-red-500 focus:ring-red-500/30" : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500/30"} ${inputClassName}`}
      />
      {hasError ? (
        <p id={errorId} className="mt-1.5 text-sm text-red-600" role="alert">{error}</p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-gray-400">{hint}</p>
      ) : null}
    </div>
  );
}
