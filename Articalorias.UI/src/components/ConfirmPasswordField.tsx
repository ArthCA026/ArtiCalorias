import { useState } from "react";
import { validateConfirmPassword } from "@/utils/passwordValidation";
import { EyeIcon, EyeOffIcon } from "@/components/auth/icons";

interface ConfirmPasswordFieldProps {
  id: string;
  label?: string;
  password: string;
  value: string;
  onChange: (value: string) => void;
  touched: boolean;
  onBlur: () => void;
  submitted: boolean;
  autoComplete?: string;
}

export default function ConfirmPasswordField({
  id,
  label = "Confirm password",
  password,
  value,
  onChange,
  touched,
  onBlur,
  submitted,
  autoComplete = "new-password",
}: ConfirmPasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  const error = validateConfirmPassword(password, value);
  const showError = error && (submitted || touched);
  const showMatch = touched && !error && value.length > 0;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>

      <div className="relative mt-1">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={showError ? "true" : undefined}
          aria-describedby={showError ? `${id}-error` : showMatch ? `${id}-match` : undefined}
          className={`block w-full rounded-md border pr-10 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${showError ? "border-red-400 focus:border-red-500 focus:ring-red-500/30" : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500/30"}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 rounded-r-md"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>

      {showError && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-red-600" role="alert">{error}</p>
      )}
      {showMatch && (
        <p id={`${id}-match`} className="mt-1.5 text-sm text-green-600" role="status">✓ Looks good — passwords match</p>
      )}
    </div>
  );
}
