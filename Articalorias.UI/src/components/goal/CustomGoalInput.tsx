import { useState } from "react";
import {
  CUSTOM_KG_MIN,
  CUSTOM_KG_MAX,
  validateCustomKg,
  getCustomKgHint,
  kgPerWeekToKcal,
  formatKcalAdjustment,
} from "@/utils/goalUtils";
import { useUnits } from "@/hooks/useUnits";
import { weightLabel } from "@/utils/units";

interface CustomGoalInputProps {
  /** Pre-filled kg/week value derived from the currently saved kcal. */
  initialKgPerWeek: string;
  /** Called with the computed kcal string when the user submits a valid value. */
  onApply: (kcal: string) => void;
  /** Called when the user clicks "Back to presets". */
  onBack: () => void;
  disabled: boolean;
}

/**
 * Inline custom-goal panel.
 * Owns its own input and validation state — no state leaks to the parent.
 * The parent only receives a kcal string via onApply.
 */
export default function CustomGoalInput({ initialKgPerWeek, onApply, onBack, disabled }: CustomGoalInputProps) {
  const { weightUnit, energyUnit } = useUnits();

  // Convert the initial kg/week value to the display unit for the input
  const initialDisplayValue = weightUnit === "lbs"
    ? String(Math.round((parseFloat(initialKgPerWeek) || 0) * 2.20462 * 100) / 100)
    : initialKgPerWeek;

  const [kgPerWeekDisplay, setKgPerWeekDisplay] = useState(initialDisplayValue);
  const [error, setError] = useState<string | null>(null);

  // Convert display value back to kg/week for calculations
  const kgPerWeekKg = weightUnit === "lbs"
    ? (parseFloat(kgPerWeekDisplay) || 0) / 2.20462
    : parseFloat(kgPerWeekDisplay) || 0;

  const parsedKg = isNaN(kgPerWeekKg) ? NaN : kgPerWeekKg;
  const liveKcal = isNaN(parsedKg) ? null : formatKcalAdjustment(kgPerWeekToKcal(parsedKg), energyUnit);
  const hint = getCustomKgHint(String(kgPerWeekKg));
  const isWarning = hint?.icon === "warning";

  function handleApply() {
    const err = validateCustomKg(kgPerWeekDisplay, weightUnit);
    if (err) { setError(err); return; }
    onApply(String(kgPerWeekToKcal(kgPerWeekKg)));
  }

  return (
    <div className="space-y-2">
      <label htmlFor="custom-kg-week" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
        Custom weekly target
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <input
          id="custom-kg-week"
          type="number"
          step="0.05"
          min={weightUnit === "lbs" ? String(Math.round(CUSTOM_KG_MIN * 2.20462 * 100) / 100) : String(CUSTOM_KG_MIN)}
          max={weightUnit === "lbs" ? String(Math.round(CUSTOM_KG_MAX * 2.20462 * 100) / 100) : String(CUSTOM_KG_MAX)}
          inputMode="decimal"
          value={kgPerWeekDisplay}
          onChange={(e) => { setKgPerWeekDisplay(e.target.value); setError(null); }}
          disabled={disabled}
          placeholder={weightUnit === "lbs" ? "e.g. −0.88" : "e.g. −0.40"}
          className={`block w-28 min-h-[40px] rounded-md border px-2.5 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 shadow-sm focus:outline-none focus:ring-1 ${
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500"
          }`}
        />
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{weightLabel(weightUnit)}/week</span>
        {liveKcal && (
          <span className="text-xs text-gray-400 dark:text-gray-500">≈ {liveKcal}</span>
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">Negative values lose weight. Positive values gain weight.</p>

      {hint && (
          <div role="status" className={`flex items-start gap-1.5 rounded-md px-2.5 py-1.5 text-xs ${isWarning ? "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400" : "bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400"}`}>
          {isWarning ? (
            <svg className="mt-px h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ) : (
            <svg className="mt-px h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          <span>{hint.text}</span>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600" role="alert">{error}</p>
      )}

      <div className="flex items-center gap-3 pt-0.5">
        <button
          type="button"
          disabled={disabled}
          onClick={handleApply}
          className="rounded-md bg-indigo-600 px-3 py-2 min-h-[40px] text-xs font-medium text-white transition-colors hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
        >
          {disabled ? "Saving…" : "Apply"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onBack}
          className="inline-flex min-h-[40px] items-center rounded text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
