import { useState, useEffect, useRef } from "react";
import { PROTEIN_PRESETS, getAgeProteinMinimum } from "@/config/proteinPresets";
import type { ProteinPreset, ProteinPresetId } from "@/config/proteinPresets";

// ── Public API ────────────────────────────────────────────────────────────────

export interface ProteinPresetSelectorProps {
  /** Last confirmed saved preset id, or "" when a custom value is saved. */
  savedPresetId: string;
  /** Last confirmed saved grams (string). Used to pre-fill the custom input. */
  savedGrams: string;
  /** User's weight (string from the form) — used for live g/day preview. */
  weightKg: string;
  /** Daily kcal adjustment from the calorie goal (negative = deficit, positive = surplus). */
  goalKcal: string;
  /** User's age (string from the form) — used for the age-aware protein minimum floor. */
  age: string;
  disabled: boolean;
  /** User selected a preset. Caller should persist immediately. */
  onPresetSelect: (presetId: ProteinPresetId, computedGrams: string) => void;
  /** User confirmed a custom grams value. Caller should persist immediately. */
  onCustomApply: (grams: string) => void;
}

/** Returns a subtle contextual hint based on the calorie goal, or null for maintenance. */
function getGoalHint(goalKcal: string): string | null {
  const kcal = parseFloat(goalKcal);
  if (isNaN(kcal)) return null;
  if (kcal < -100) return "Higher protein is often helpful during weight loss.";
  if (kcal > 100) return "Protein supports recovery and muscle building.";
  return null;
}

// ── Scale cell ────────────────────────────────────────────────────────────────

interface ScaleCellProps {
  preset: ProteinPreset;
  isSelected: boolean;
  isAdjacent: boolean;
  isLeftOfSelected: boolean;
  disabled: boolean;
  onChange: (id: ProteinPresetId) => void;
  /** Personalised g/day for this preset, or null when weight is unknown. */
  computedGrams: number | null;
  /** Extra class names (e.g. col-span-full for the lone last item on mobile). */
  className?: string;
}

function ScaleCell({
  preset,
  isSelected,
  isAdjacent,
  isLeftOfSelected: _isLeftOfSelected,
  disabled,
  onChange,
  computedGrams,
  className,
}: ScaleCellProps) {
  return (
    <label
      title={
        computedGrams != null
          ? `${preset.label} — ${computedGrams} g/day · ${preset.gramsPerKg} g/kg`
          : `${preset.label} — ${preset.description} · ${preset.gramsPerKg} g/kg`
      }
      className={[
        "flex w-full cursor-pointer select-none flex-col items-center justify-center touch-manipulation",
        "px-1 py-2.5 min-h-11 min-w-0 text-center text-xs font-medium leading-tight",
        "transition-colors duration-200",
        // Keyboard focus ring is inset so it doesn't bleed outside the container.
        "focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500",
        isSelected
          ? "bg-indigo-600 text-white font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
          : isAdjacent
          ? "bg-indigo-50 text-indigo-500"
          : "bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700",
        disabled ? "pointer-events-none opacity-50" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/*
       * Visually-hidden radio for full keyboard + screen-reader semantics.
       * The label click / Enter key toggles the radio, which fires onChange.
       */}
      <input
        type="radio"
        name="proteinPreset"
        value={preset.id}
        checked={isSelected}
        onChange={() => onChange(preset.id)}
        disabled={disabled}
        aria-label={`${preset.label} — ${preset.description}`}
        className="sr-only"
      />
      <span className="leading-tight">{preset.label}</span>
      <span className={[
        "mt-0.5 text-[10px] font-normal leading-tight",
        isSelected ? "text-indigo-200" : "text-gray-400",
      ].join(" ")}>
        {computedGrams != null ? `${computedGrams} g` : `${preset.gramsPerKg} g/kg`}
      </span>
    </label>
  );
}

// ── Custom input panel ────────────────────────────────────────────────────────

const CUSTOM_MIN = 40;
const CUSTOM_MAX = 300;

function validateCustomGrams(raw: string): string | null {
  if (raw.trim() === "") return "Enter a value";
  const n = parseFloat(raw);
  if (isNaN(n) || !isFinite(n)) return "Enter a valid number";
  if (n < CUSTOM_MIN) return `Minimum is ${CUSTOM_MIN} g/day`;
  if (n > CUSTOM_MAX) return `Maximum is ${CUSTOM_MAX} g/day`;
  return null;
}

interface CustomInputProps {
  initialGrams: string;
  weightKg: string;
  onApply: (grams: string) => void;
  onBack: () => void;
  disabled: boolean;
}

function CustomInput({ initialGrams, weightKg, onApply, onBack, disabled }: CustomInputProps) {
  const [value, setValue] = useState(initialGrams);
  // Only show an error after the first apply attempt, not on initial render.
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const error = touched ? validateCustomGrams(value) : null;

  // Live g/kg hint — only shown when value is a valid number and weight is known.
  const gramsNum = parseFloat(value);
  const weightNum = parseFloat(weightKg);
  const gramsPerKgHint =
    !isNaN(gramsNum) && gramsNum > 0 && weightNum > 0
      ? (gramsNum / weightNum).toFixed(1)
      : null;

  function handleApply() {
    setTouched(true);
    if (validateCustomGrams(value) !== null) return;
    onApply(String(Math.round(gramsNum)));
  }

  const inputCls = [
    "block w-full rounded-md border bg-white px-3 py-2 pr-14 text-sm text-gray-900",
    "transition-colors focus:outline-none",
    "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400",
    error
      ? "border-red-300 hover:border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/20"
      : "border-gray-200 hover:border-gray-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20",
  ].join(" ");

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-600">
        Custom protein target
      </label>

      {/* Input with inset unit suffix */}
      <div>
        <div className="relative">
          <input
            ref={inputRef}
            id="custom-protein-input"
            type="number"
            step="1"
            inputMode="numeric"
            value={value}
            onChange={(e) => { setValue(e.target.value); if (touched) setTouched(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }}
            disabled={disabled}
            placeholder="e.g. 130"
            aria-label="Custom daily protein target in grams per day"
            aria-describedby={
              error ? "custom-protein-error" : gramsPerKgHint != null ? "custom-protein-hint" : undefined
            }
            aria-invalid={error != null}
            className={inputCls}
          />
          <span
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-gray-400 select-none"
            aria-hidden="true"
          >
            g/day
          </span>
        </div>

        {/* Inline error */}
        {error && (
          <p id="custom-protein-error" className="mt-1 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}

        {/* g/kg hint — hidden when there is an error to keep things compact */}
        {!error && gramsPerKgHint != null && (
          <p id="custom-protein-hint" className="mt-1 text-xs text-gray-400">
            about {gramsPerKgHint} g/kg
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={disabled}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:opacity-50"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={disabled}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:opacity-50"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

// ── Pencil icon (shared by "Set custom target" and "Edit") ────────────────────

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Protein preset selector — a compact scale-like control that mirrors the
 * calorie GoalSelector in structure and visual language.
 *
 * State model:
 *  - localPresetId  — optimistically highlighted preset (or "" for custom).
 *  - showCustomInput — whether the custom input form occupies the detail row.
 *
 * Three detail-row faces:
 *  1. Preset active  → label, g/day preview, g/kg rate, description + "Set custom" link.
 *  2. Custom saved   → "Custom target" heading + saved grams + "Edit" link.
 *  3. Input open     → CustomInput panel (replaces detail content; caption row hidden).
 *
 * When the parent confirms a save (savedPresetId / savedGrams props change),
 * the component syncs local state and closes the input panel automatically —
 * the same pattern GoalSelector uses.
 */
export default function ProteinPresetSelector({
  savedPresetId,
  savedGrams,
  weightKg,
  goalKcal,
  age,
  disabled,
  onPresetSelect,
  onCustomApply,
}: ProteinPresetSelectorProps) {
  const [localPresetId, setLocalPresetId] = useState(savedPresetId);
  const [showCustomInput, setShowCustomInput] = useState(false);
  // Ref to the pencil trigger button so focus can be restored after closing the
  // custom input (both via Back and successful Apply).
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Sync when the parent confirms a save (prop change = round-trip complete).
  useEffect(() => {
    setLocalPresetId(savedPresetId);
    setShowCustomInput(false);
  }, [savedPresetId, savedGrams]);

  const selectedIndex = PROTEIN_PRESETS.findIndex((p) => p.id === localPresetId);
  const isCustomActive = savedPresetId === "";

  function handlePresetClick(presetId: ProteinPresetId) {
    const preset = PROTEIN_PRESETS.find((p) => p.id === presetId)!;
    const weight = parseFloat(weightKg);
    const ageNum = parseInt(age);
    const ageMin = !isNaN(ageNum) && ageNum > 0 ? getAgeProteinMinimum(ageNum) : 0;
    const finalMultiplier = Math.max(preset.gramsPerKg, ageMin);
    const computedGrams = weight > 0 ? String(Math.round(weight * finalMultiplier)) : "";
    setLocalPresetId(presetId);
    setShowCustomInput(false);
    onPresetSelect(presetId, computedGrams);
  }

  function handleCustomApply(grams: string) {
    // Optimistically close; parent will sync props on confirmed save.
    setShowCustomInput(false);
    // Restore keyboard focus to the trigger button once the panel unmounts.
    requestAnimationFrame(() => triggerRef.current?.focus());
    onCustomApply(grams);
  }

  const activePreset = PROTEIN_PRESETS.find((p) => p.id === localPresetId);
  const weight = parseFloat(weightKg);
  const ageNum = parseInt(age);
  const ageMin = !isNaN(ageNum) && ageNum > 0 ? getAgeProteinMinimum(ageNum) : 0;
  const isAgeAdjusted = activePreset != null && ageMin > activePreset.gramsPerKg;
  const effectiveMultiplier = activePreset != null ? Math.max(activePreset.gramsPerKg, ageMin) : 0;
  const previewGrams =
    activePreset && weight > 0 ? Math.round(weight * effectiveMultiplier) : null;
  const goalHint = getGoalHint(goalKcal);

  return (
    <fieldset className="w-full min-w-0">
      <legend className="sr-only">Choose your daily protein target</legend>

      {/*
       * Unified container — scale + caption + detail share one rounded border,
       * matching the GoalSelector shell exactly.
       */}
      <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">

        {/* ── Scale — 2-col grid on mobile, single row on desktop ── */}
        <div
          role="group"
          aria-label="Protein presets"
          className="grid grid-cols-2 gap-px bg-gray-200 overflow-hidden sm:grid-cols-5"
        >
          {PROTEIN_PRESETS.map((p, i) => (
            <ScaleCell
              key={p.id}
              preset={p}
              isSelected={p.id === localPresetId}
              isAdjacent={selectedIndex >= 0 && Math.abs(i - selectedIndex) === 1}
              isLeftOfSelected={selectedIndex >= 0 && i === selectedIndex - 1}
              onChange={handlePresetClick}
              disabled={disabled}
              computedGrams={weight > 0 ? Math.round(weight * p.gramsPerKg) : null}
              className={
                i === PROTEIN_PRESETS.length - 1 && PROTEIN_PRESETS.length % 2 !== 0
                  ? "col-span-full sm:col-span-1"
                  : undefined
              }
            />
          ))}
        </div>

        {/* ── Caption row — hidden on mobile (2-col grid makes left/right
            directional labels ambiguous) and when custom input is open. ── */}
        {!showCustomInput && (
          <div
            className="hidden sm:flex select-none justify-between px-3 pb-1.5 pt-1"
            aria-hidden="true"
          >
            <span className="text-[10px] text-gray-400">← Less protein</span>
            <span className="text-[10px] text-gray-400">More protein →</span>
          </div>
        )}

        {/* ── Detail row ── */}
        <div className="border-t border-gray-100 px-3 py-3">

          {/* Face 1: a preset is active */}
          {!showCustomInput && !isCustomActive && activePreset && (
            <>
              <p className="text-sm font-medium text-gray-800">
                {activePreset.label} protein
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {activePreset.gramsPerKg} g/kg
                {previewGrams != null && (
                  <>
                    <span className="mx-1.5 text-gray-300" aria-hidden="true">·</span>
                    about <strong className="text-gray-700">{previewGrams} g/day</strong>
                  </>
                )}
              </p>
              <p className="mt-0.5 text-xs text-gray-400">{activePreset.description}</p>
              {isAgeAdjusted && (
                <p className="mt-1.5 text-[11px] text-amber-600 italic">
                  Adjusted for age: older adults often benefit from a slightly higher minimum protein target.
                </p>
              )}
              {goalHint && (
                <p className="mt-1.5 text-[11px] text-gray-400 italic">{goalHint}</p>
              )}
              <div className="mt-2 flex justify-end">
                <button
                  ref={triggerRef}
                  type="button"
                  disabled={disabled}
                  onClick={() => setShowCustomInput(true)}
                  className="inline-flex items-center gap-1.5 rounded px-1 py-1 text-xs text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50"
                >
                  <PencilIcon className="h-3 w-3" />
                  Set custom target
                </button>
              </div>
            </>
          )}

          {/* Face 2: a custom value is saved */}
          {!showCustomInput && isCustomActive && (() => {
            const grams = savedGrams ? Math.round(parseFloat(savedGrams)) : null;
            const w = parseFloat(weightKg);
            const gramsPerKgCustom =
              grams != null && w > 0
                ? (grams / w).toFixed(1)
                : null;
            return (
              <>
                <p className="text-sm font-medium text-gray-700">Custom target</p>
                {grams != null && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    <strong className="text-gray-700">{grams} g/day</strong>
                    {gramsPerKgCustom != null && (
                      <>
                        <span className="mx-1.5 text-gray-300" aria-hidden="true">·</span>
                        about {gramsPerKgCustom} g/kg
                      </>
                    )}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-gray-400">Custom protein goal</p>
                {goalHint && (
                  <p className="mt-1.5 text-[11px] text-gray-400 italic">{goalHint}</p>
                )}
                <div className="mt-2 flex justify-end">
                  <button
                    ref={triggerRef}
                    type="button"
                    disabled={disabled}
                    onClick={() => setShowCustomInput(true)}
                    className="inline-flex items-center gap-1.5 rounded px-1 py-1 text-xs text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50"
                  >
                    <PencilIcon className="h-3 w-3" />
                    Edit custom target
                  </button>
                </div>
              </>
            );
          })()}

          {/* Face 3: custom input form open */}
          {showCustomInput && (
            <CustomInput
              initialGrams={savedGrams}
              weightKg={weightKg}
              onApply={handleCustomApply}
              onBack={() => {
                setShowCustomInput(false);
                requestAnimationFrame(() => triggerRef.current?.focus());
              }}
              disabled={disabled}
            />
          )}

        </div>
      </div>
    </fieldset>
  );
}
