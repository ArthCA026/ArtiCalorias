import { memo, useRef, useEffect } from "react";
import { GOAL_PRESETS, type GoalPresetKey } from "@/utils/goalUtils";
import GoalPresetButton from "./GoalPresetButton";

interface GoalPresetScaleProps {
  /** The currently active preset key, or "" when no preset is selected (e.g. custom mode). */
  selectedKey: GoalPresetKey | "";
  onChange: (key: GoalPresetKey) => void;
  disabled: boolean;
}

/**
 * A horizontal scale of 7 equal-width preset buttons representing a progression
 * from aggressive deficit (left) to weight gain (right).
 *
 * Responsive strategy
 * ───────────────────
 * Desktop / tablet (sm+, ≥ 640 px):
 *   grid-cols-7 fills the full container width — all options in one row, equal width.
 *
 * Mobile (< 640 px):
 *   The grid is given min-w-[630px] (= 90 px × 7 cells), which ensures every label
 *   fits on one line at text-xs without wrapping.  The scroll wrapper exposes the
 *   overflow horizontally within the shared container.
 *
 *   On mount the component scrolls the currently-selected cell to the centre of the
 *   visible area so a saved "Gain" or "Minimal" selection is never invisibly
 *   off-screen.  After mount the user scrolls freely; we do not re-scroll on every
 *   selection change to avoid fighting the user's own scrolling.
 *
 * Intentionally has no outer border or directional labels — GoalSelector's shared
 * container provides the border, and the labels live in the container's caption row.
 */
function GoalPresetScale({ selectedKey, onChange, disabled }: GoalPresetScaleProps) {
  const selectedIndex = GOAL_PRESETS.findIndex((p) => p.key === selectedKey);
  const scrollRef = useRef<HTMLDivElement>(null);

  // On mount: centre the selected cell within the visible scroll viewport.
  // Only runs once so it never fights the user's own scrolling.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || selectedIndex < 0) return;
    const cellWidth = el.scrollWidth / GOAL_PRESETS.length;
    const targetLeft = cellWidth * selectedIndex - (el.clientWidth - cellWidth) / 2;
    el.scrollLeft = Math.max(0, targetLeft);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    // overflow-x-auto scrolls within the outer container's overflow-hidden boundary,
    // so the rounded corners always clip the moving grid correctly.
    // overscroll-contain prevents the page from scrolling when the scale reaches
    // its edges on mobile (scroll chaining / rubber-band leakthrough).
    <div ref={scrollRef} className="overflow-x-auto overscroll-contain">
      <div
        role="group"
        aria-label="Goal presets"
        // min-w-157.5 (= 630 px) × 7 keeps all labels on one line on the narrowest phones.
        // sm:min-w-0 lets the grid shrink to fill the container on wider screens.
        className="grid min-w-157.5 grid-cols-7 overflow-hidden sm:min-w-0"
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
      </div>
    </div>
  );
}

export default memo(GoalPresetScale);
