import { useState, useEffect } from "react";
import {
  GOAL_PRESETS,
  matchPreset,
  kcalToKgPerWeek,
  formatKgPerWeek,
  formatKcalAdjustment,
  type GoalPresetKey,
} from "@/utils/goalUtils";
import GoalPresetScale from "./GoalPresetScale";
import GoalSummary from "./GoalSummary";
import CustomGoalInput from "./CustomGoalInput";

interface GoalSelectorProps {
  /** The currently saved daily kcal adjustment (string form of the API value). */
  selectedKcal: string;
  /** Called immediately when the user picks a preset or applies a custom value. */
  onGoalChange: (kcal: string) => void;
  disabled: boolean;
}

/** Pencil icon shared by both the "Set custom target" link and the "Edit" button. */
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

/**
 * Segmented goal selector.
 *
 * State model:
 *  - goalPreset  — the optimistically highlighted preset key (or "" when none).
 *  - showCustomInput — whether the custom input form is open.
 *  - isCustomActive — derived from selectedKcal: true when a non-preset value is saved.
 *
 * The scale is always rendered so users can click any preset to leave a custom value.
 * The summary zone below the scale switches between three faces:
 *   1. Preset active  → GoalSummary card + "Set custom target" link.
 *   2. Custom active  → Neutral custom-summary card + "Edit" button.
 *   3. Input open     → CustomGoalInput panel (replaces summary zone entirely).
 */
export default function GoalSelector({ selectedKcal, onGoalChange, disabled }: GoalSelectorProps) {
  const [goalPreset, setGoalPreset] = useState<GoalPresetKey | "">(
    () => matchPreset(selectedKcal).preset,
  );
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Derived — always reflects the last confirmed saved value, not optimistic state.
  const isCustomActive = matchPreset(selectedKcal).isCustom;

  // Whenever a value is confirmed saved (prop changes), sync display state and
  // close the input form if it was open.
  useEffect(() => {
    const { preset } = matchPreset(selectedKcal);
    setGoalPreset(preset);
    setShowCustomInput(false);
  }, [selectedKcal]);

  function handleSelectPreset(key: GoalPresetKey) {
    const preset = GOAL_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    // Optimistic: highlight immediately; form closes; parent receives kcal to save.
    setGoalPreset(key);
    setShowCustomInput(false);
    onGoalChange(preset.kcal);
  }

  const activePreset = GOAL_PRESETS.find((p) => p.key === goalPreset);
  const savedKcalNum = Number(selectedKcal);
  const savedKgPerWeek = parseFloat(kcalToKgPerWeek(savedKcalNum));

  return (
    <fieldset className="w-full min-w-0">
      <legend className="sr-only">Choose your weight goal</legend>

      {/*
       * Unified container — one rounded border wraps the scale and the summary
       * so they share chrome and read as a single control rather than siblings.
       *
       * Structure:
       *   ┌─[scale cells — full-width, no inner border]──────────────┐
       *   │ ← More deficit                        More surplus →     │  ← caption row
       *   ├──────────────────────────────────────────────────────────┤  ← border-t
       *   │  [summary text or custom input]                          │  ← detail row
       *   └──────────────────────────────────────────────────────────┘
       */}
      {/* shadow-sm lifts the control just enough to distinguish it from the flat
          form background without making it look like a card or modal. */}
      <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">

        {/* Scale — fills the top of the container; no border of its own */}
        <GoalPresetScale
          selectedKey={goalPreset}
          onChange={handleSelectPreset}
          disabled={disabled}
        />

        {/* Caption row: directional labels — hidden on mobile where the
            4-col wrapping grid makes left/right directions ambiguous. */}
        {!showCustomInput && (
          <div
            className="flex select-none justify-between px-3 pb-1.5 pt-1"
            aria-hidden="true"
          >
            <span className="text-[10px] text-gray-400">← More deficit</span>
            <span className="text-[10px] text-gray-400">More surplus →</span>
          </div>
        )}

        {/* Detail row — same container, separated from scale by a thin rule */}
        <div className="border-t border-gray-100 px-3 py-2 sm:py-3">

          {/* Face 1: preset active */}
          {!showCustomInput && !isCustomActive && activePreset && (
            <>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <GoalSummary preset={activePreset} />
                </div>
                {/* Mobile: “Custom” shortcut — top-right of summary */}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setShowCustomInput(true)}
                  className="sm:hidden shrink-0 mt-0.5 inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50"
                >
                  <PencilIcon className="h-3 w-3" />
                  Custom
                </button>
              </div>
              {/* Desktop: “Set custom target” link — bottom-right */}
              <div className="hidden sm:flex mt-2 justify-end">
                <button
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

          {/* Face 2: custom value saved — gray tone matches "off-scale" state */}
          {!showCustomInput && isCustomActive && (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-700">Custom target</p>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setShowCustomInput(true)}
                  className="inline-flex shrink-0 items-center gap-1 text-xs text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50"
                >
                  <PencilIcon className="h-3 w-3" />
                  Edit
                </button>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                {formatKgPerWeek(savedKgPerWeek)}
                <span className="mx-1.5 text-gray-300" aria-hidden="true">·</span>
                {formatKcalAdjustment(savedKcalNum)}
              </p>
            </>
          )}

          {/* Face 3: custom input form — replaces summary content in the same slot */}
          {showCustomInput && (
            <CustomGoalInput
              initialKgPerWeek={kcalToKgPerWeek(savedKcalNum)}
              onApply={onGoalChange}
              onBack={() => setShowCustomInput(false)}
              disabled={disabled}
            />
          )}

        </div>
      </div>
    </fieldset>
  );
}

