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
 * The parent container (grid + outer border) supplies the shared frame; individual cells
 * only render a right-side divider so the row reads as one continuous control.
 */
function GoalPresetButton({ preset, isSelected, isAdjacent, isLeftOfSelected, onChange, disabled }: GoalPresetButtonProps) {
  // Divider: hide on the selected cell itself and on its left neighbour so the
  // active region has no internal seam.
  const showDivider = !isSelected && !isLeftOfSelected;

  return (
    <label
      title={`${preset.label} — ${preset.desc}`}
      className={[
        "flex w-full cursor-pointer select-none items-center justify-center touch-manipulation",
        "px-1 py-2.5 min-h-[44px] text-center text-xs font-medium leading-tight",
        // 200 ms feels smoother than 150 ms for a deliberate selection gesture.
        "transition-colors duration-200",
        "focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500",
        showDivider ? "border-r border-gray-200 last:border-r-0" : "border-r-0",
        isSelected
          // font-semibold distinguishes the active label at small sizes.
          // The inset shadow adds a 1 px top-edge highlight — subtle depth, not a glow.
          ? "bg-indigo-600 text-white font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
          : isAdjacent
          // indigo-500 (vs 600) feels like a gentle echo rather than a second highlight.
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
