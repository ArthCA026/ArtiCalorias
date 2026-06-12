import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { validatePassword } from "@/utils/passwordValidation";
import { EyeIcon, EyeOffIcon } from "@/components/auth/icons";

interface PasswordCreateFieldProps {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  touched: boolean;
  onBlur: () => void;
  submitted: boolean;
  autoComplete?: string;
}

function getStrength(pw: string): { score: number; labelKey: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score: 1, labelKey: "strength_weak", color: "bg-red-500" };
  if (score <= 2) return { score: 2, labelKey: "strength_fair", color: "bg-orange-400" };
  if (score <= 3) return { score: 3, labelKey: "strength_good", color: "bg-yellow-400" };
  if (score === 4) return { score: 4, labelKey: "strength_strong", color: "bg-green-400" };
  return { score: 5, labelKey: "strength_very_strong", color: "bg-green-600" };
}

export default function PasswordCreateField({
  id,
  label,
  value,
  onChange,
  touched,
  onBlur,
  submitted,
  autoComplete = "new-password",
}: PasswordCreateFieldProps) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('auth.password.label');
  const [visible, setVisible] = useState(false);

  const error = validatePassword(value);
  const showError = error && (submitted || touched);

  const strength = useMemo(() => (value.length > 0 ? getStrength(value) : null), [value]);

  const hasMinLength = value.length >= 8;
  const hasUppercase = /[A-Z]/.test(value);
  const hasNumber = /[0-9]/.test(value);
  const hasSpecial = /[^A-Za-z0-9]/.test(value);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">{resolvedLabel}</label>

      <div className="relative mt-1">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={showError ? "true" : undefined}
          aria-describedby={`${id}-hint ${id}-reqs`}
          className={`block w-full rounded-md border pr-10 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 ${showError ? "border-red-400 focus:border-red-500 focus:ring-red-500/30" : "border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500/30"}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 rounded-r-md"
          aria-label={visible ? t('auth.password.hide') : t('auth.password.show')}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>

      {showError && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-red-600" role="alert">{error}</p>
      )}

      {/* Strength meter */}
      {strength && (
        <div className="mt-2">
          <div className="flex gap-1" role="meter" aria-valuenow={strength.score} aria-valuemin={1} aria-valuemax={5} aria-label="Password strength">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : "bg-gray-200 dark:bg-gray-700"}`} />
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('auth.password.strength_label', { level: t(`auth.password.${strength.labelKey}`) })}</p>
        </div>
      )}

      {/* Requirements checklist */}
      <ul id={`${id}-reqs`} className="mt-2 space-y-0.5 text-xs" aria-label="Password requirements">
        <li className={hasMinLength ? "text-green-600" : "text-gray-400 dark:text-gray-500"}>
          <span aria-hidden="true">{hasMinLength ? "✓" : "○"}</span> {t('auth.password.req_length')}
        </li>
        <li className={hasUppercase ? "text-green-600" : "text-gray-400 dark:text-gray-500"}>
          <span aria-hidden="true">{hasUppercase ? "✓" : "○"}</span> {t('auth.password.req_uppercase')}
        </li>
        <li className={hasNumber ? "text-green-600" : "text-gray-400 dark:text-gray-500"}>
          <span aria-hidden="true">{hasNumber ? "✓" : "○"}</span> {t('auth.password.req_number')}
        </li>
        <li className={hasSpecial ? "text-green-600" : "text-gray-400 dark:text-gray-500"}>
          <span aria-hidden="true">{hasSpecial ? "✓" : "○"}</span> {t('auth.password.req_special')}
        </li>
      </ul>
    </div>
  );
}
