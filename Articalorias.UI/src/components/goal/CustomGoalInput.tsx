import { useState } from "react";
import {
  CUSTOM_KG_MIN,
  CUSTOM_KG_MAX,
  validateCustomKg,
  getCustomKgHint,
  kgPerWeekToKcal,
  formatKcalAdjustment,
} from "@/utils/goalUtils";

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
  const [kgPerWeek, setKgPerWeek] = useState(initialKgPerWeek);
  const [error, setError] = useState<string | null>(null);

  const parsedKg = parseFloat(kgPerWeek);
  const liveKcal = isNaN(parsedKg) ? null : formatKcalAdjustment(kgPerWeekToKcal(parsedKg));
  const hint = getCustomKgHint(kgPerWeek);
  const isWarning = hint?.icon === "warning";

  function handleApply() {
    const err = validateCustomKg(kgPerWeek);
    if (err) { setError(err); return; }
    onApply(String(kgPerWeekToKcal(parseFloat(kgPerWeek))));
  }

  return (
    <div className="space-y-2">
      <label htmlFor="custom-kg-week" className="block text-xs font-medium text-gray-700">
        Custom weekly target
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <input
          id="custom-kg-week"
          type="number"
          step="0.05"
          min={String(CUSTOM_KG_MIN)}
          max={String(CUSTOM_KG_MAX)}
          inputMode="decimal"
          value={kgPerWeek}
          onChange={(e) => { setKgPerWeek(e.target.value); setError(null); }}
          disabled={disabled}
          placeholder="e.g. −0.40"
          className={`block w-28 min-h-[40px] rounded-md border px-2.5 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 ${
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
          }`}
        />
        <span className="text-xs font-medium text-gray-500">kg/week</span>
        {liveKcal && (
          <span className="text-xs text-gray-400">≈ {liveKcal}</span>
        )}
      </div>

      <p className="text-xs text-gray-400">Negative values lose weight. Positive values gain weight.</p>

      {hint && (
        <div role="status" className={`flex items-start gap-1.5 rounded-md px-2.5 py-1.5 text-xs ${isWarning ? "bg-amber-50 text-amber-700" : "bg-sky-50 text-sky-700"}`}>
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
