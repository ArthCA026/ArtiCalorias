import { memo } from "react";
import { GOAL_PRESETS, type GoalPresetKey } from "@/utils/goalUtils";
import GoalPresetButton from "./GoalPresetButton";

interface GoalPresetScaleProps {
  /** The currently active preset key, or "" when no preset is selected (e.g. custom mode). */
  selectedKey: GoalPresetKey | "";
  onChange: (key: GoalPresetKey) => void;
  disabled: boolean;
}

/**
 * A segmented scale of 7 equal-width preset buttons.
 *
 * Responsive strategy
 * ───────────────────
 * Desktop (sm+, ≥ 640 px): grid-cols-7 — all options in one row, equal width.
 *
 * Mobile (< 640 px): grid-cols-4 — options wrap into two rows (4 + 3).
 *   A ghost cell fills the empty 4th slot in the second row so the
 *   gap-px container background does not show as a stray gray square.
 *
 * Cell dividers are provided by gap-px + bg-gray-200 on the grid container;
 * individual cells no longer carry border-r/border-l classes.
 */
function GoalPresetScale({ selectedKey, onChange, disabled }: GoalPresetScaleProps) {
  const selectedIndex = GOAL_PRESETS.findIndex((p) => p.key === selectedKey);

  // Fill the trailing empty slot(s) in the last row on mobile (4-col grid).
  const mobileCols = 4;
  const remainder = GOAL_PRESETS.length % mobileCols;
  const ghostCount = remainder === 0 ? 0 : mobileCols - remainder;

  return (
    <div
      role="group"
      aria-label="Goal presets"
      className="grid grid-cols-4 gap-px bg-gray-200 overflow-hidden sm:grid-cols-7"
    >
      {GOAL_PRESETS.map((p, i) => (
        <GoalPresetButton
          key={p.key}
          preset={p}
          isSelected={p.key === selectedKey}
          isAdjacent={selectedIndex >= 0 && Math.abs(i - selectedIndex) === 1}
          isLeftOfSelected={selectedIndex >= 0 && i === selectedIndex - 1}
          onChange={onChange}
          disabled={disabled}
        />
      ))}
      {/* Ghost cells prevent the gray gap-px background from showing in
          the empty trailing slot(s) of the last row on mobile. */}
      {Array.from({ length: ghostCount }).map((_, i) => (
        <div key={`ghost-${i}`} className="bg-white sm:hidden" aria-hidden="true" />
      ))}
    </div>
  );
}

export default memo(GoalPresetScale);
