import { useState } from "react";
import type { ClipboardEvent, ReactNode } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/auth/icons";

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
  showPasswordToggle?: boolean;
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
  showPasswordToggle = false,
}: FormFieldProps) {
  const [visible, setVisible] = useState(false);
  const hasError = !!(showError && error);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const resolvedType = showPasswordToggle && visible ? "text" : type;

  return (
    <div>
      <div className={labelRight ? "flex items-center justify-between" : undefined}>
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
        {labelRight}
      </div>
      <div className={showPasswordToggle ? "relative mt-1" : undefined}>
        <input
          id={id}
          type={resolvedType}
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onPaste={onPaste}
          aria-invalid={hasError ? "true" : undefined}
          aria-describedby={hasError ? errorId : hint ? hintId : undefined}
          className={`${showPasswordToggle ? "" : "mt-1 "}block w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${showPasswordToggle ? "pr-10 " : ""}${hasError ? "border-red-400 focus:border-red-500 focus:ring-red-500/30" : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500/30"} ${inputClassName}`}
        />
        {showPasswordToggle && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 rounded-r-md"
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {hasError ? (
        <p id={errorId} className="mt-1.5 text-sm text-red-600" role="alert">{error}</p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-gray-400">{hint}</p>
      ) : null}
    </div>
  );
}
