import { memo } from "react";
import type { GoalPreset } from "@/utils/goalUtils";
import { formatKgPerWeek, formatKcalAdjustment } from "@/utils/goalUtils";
import { useUnits } from "@/hooks/useUnits";

interface GoalSummaryProps {
  preset: GoalPreset;
}

/**
 * Selection detail rendered inside GoalSelector's shared container.
 * Intentionally has no wrapper border or margin — positioning and chrome are
 * provided by the container so both faces (preset + custom) stay visually consistent.
 */
function GoalSummary({ preset }: GoalSummaryProps) {
  const kcalNum = Number(preset.kcal);
  const { weightUnit, energyUnit } = useUnits();

  return (
    <div>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{preset.label}</p>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        {formatKgPerWeek(preset.kgPerWeek, weightUnit)}
        <span className="mx-1.5 text-gray-300 dark:text-gray-600" aria-hidden="true">·</span>
        {formatKcalAdjustment(kcalNum, energyUnit)}
      </p>
      <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{preset.humanDesc}</p>
    </div>
  );
}

export default memo(GoalSummary);
