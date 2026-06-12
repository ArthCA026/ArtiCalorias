import { memo, useCallback, useMemo } from "react";
import { GOAL_PRESETS, formatKgPerWeekShort, type GoalPresetKey } from "@/utils/goalUtils";
import ResponsiveScaleSelector, { type ScaleOption } from "@/components/shared/ResponsiveScaleSelector";
import { useUnits } from "@/hooks/useUnits";

interface GoalPresetScaleProps {
  /** The currently active preset key, or "" when no preset is selected (e.g. custom mode). */
  selectedKey: GoalPresetKey | "";
  onChange: (key: GoalPresetKey) => void;
  disabled: boolean;
}

/**
 * Segmented goal scale.
 * Desktop (sm+): equal-width grid of 7 cells in one row.
 * Mobile: horizontal scrollable row of fixed-width cards showing label + kg/wk.
 */
function GoalPresetScale({ selectedKey, onChange, disabled }: GoalPresetScaleProps) {
  const { weightUnit } = useUnits();

  const goalOptions: ScaleOption[] = useMemo(() => GOAL_PRESETS.map((p) => ({
    key: p.key,
    label: p.shortLabel,
    mobileSecondaryValue: formatKgPerWeekShort(p.kgPerWeek, weightUnit),
    fullAriaLabel: `${p.label} — ${formatKgPerWeekShort(p.kgPerWeek, weightUnit)}`,
  })), [weightUnit]);

  const handleChange = useCallback(
    (key: string) => {
      const preset = GOAL_PRESETS.find((p) => p.key === key);
      if (preset) onChange(preset.key);
    },
    [onChange],
  );

  return (
    <ResponsiveScaleSelector
      options={goalOptions}
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
