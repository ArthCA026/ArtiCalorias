import { memo, useCallback } from "react";
import { GOAL_PRESETS, formatKgPerWeekShort, type GoalPresetKey } from "@/utils/goalUtils";
import ResponsiveScaleSelector, { type ScaleOption } from "@/components/shared/ResponsiveScaleSelector";

interface GoalPresetScaleProps {
  /** The currently active preset key, or "" when no preset is selected (e.g. custom mode). */
  selectedKey: GoalPresetKey | "";
  onChange: (key: GoalPresetKey) => void;
  disabled: boolean;
}

// Defined at module level — stable reference, no re-allocation on every render.
const GOAL_OPTIONS: ScaleOption[] = GOAL_PRESETS.map((p) => ({
  key: p.key,
  label: p.shortLabel,
  mobileSecondaryValue: formatKgPerWeekShort(p.kgPerWeek),
  fullAriaLabel: `${p.label} — ${p.desc}`,
}));

/**
 * Segmented goal scale.
 * Desktop (sm+): equal-width grid of 7 cells in one row.
 * Mobile: horizontal scrollable row of fixed-width cards showing label + kg/wk.
 */
function GoalPresetScale({ selectedKey, onChange, disabled }: GoalPresetScaleProps) {
  const handleChange = useCallback(
    (key: string) => {
      const preset = GOAL_PRESETS.find((p) => p.key === key);
      if (preset) onChange(preset.key);
    },
    [onChange],
  );

  return (
    <ResponsiveScaleSelector
      options={GOAL_OPTIONS}
      selectedKey={selectedKey}
      onChange={handleChange}
      disabled={disabled}
      radioGroupName="goalPreset"
      ariaLabel="Goal presets"
      mobileOptionMinWidth={112}
    />
  );
}

export default memo(GoalPresetScale);
