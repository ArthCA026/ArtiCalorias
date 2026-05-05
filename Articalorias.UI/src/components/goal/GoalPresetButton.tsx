import { memo } from "react";
import type { GoalPreset, GoalPresetKey } from "@/utils/goalUtils";

interface GoalPresetButtonProps {
  preset: GoalPreset;
  isSelected: boolean;
  /** True for the cell immediately to the left or right of the selected cell. */
  isAdjacent: boolean;
  /** True when this cell is the left neighbour of the selected cell (hides its right divider). */
  isLeftOfSelected: boolean;
  onChange: (key: GoalPresetKey) => void;
  disabled: boolean;
}

/**
 * A single cell in the goal scale.
 * Uses a visually-hidden radio input for full keyboard and screen-reader semantics.
 * The parent container (gap-px grid + outer border) supplies the shared frame and all
 * cell dividers; individual cells no longer carry border-r classes.
 * isLeftOfSelected is kept in the props for type compatibility.
 */
function GoalPresetButton({ preset, isSelected, isAdjacent, isLeftOfSelected: _isLeftOfSelected, onChange, disabled }: GoalPresetButtonProps) {
  return (
    <label
      title={`${preset.label} — ${preset.desc}`}
      className={[
        "flex w-full cursor-pointer select-none items-center justify-center touch-manipulation",
        "px-1 py-2.5 min-h-[44px] text-center text-xs font-medium leading-tight",
        "transition-colors duration-200",
        "focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500",
        isSelected
          ? "bg-indigo-600 text-white font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
          : isAdjacent
          ? "bg-indigo-50 text-indigo-500"
          : "bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700",
        disabled ? "pointer-events-none opacity-50" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <input
        type="radio"
        name="goalPreset"
        value={preset.key}
        checked={isSelected}
        onChange={() => onChange(preset.key)}
        disabled={disabled}
        aria-label={`${preset.label} — ${preset.desc}`}
        className="sr-only"
      />
      {preset.shortLabel}
    </label>
  );
}

export default memo(GoalPresetButton);
