import { memo } from "react";
import type { GoalPreset } from "@/utils/goalUtils";
import { formatKgPerWeek, formatKcalAdjustment } from "@/utils/goalUtils";

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

  return (
    <div>
      <p className="text-sm font-medium text-gray-800">{preset.label}</p>
      <p className="mt-0.5 text-xs text-gray-500">
        {formatKgPerWeek(preset.kgPerWeek)}
        <span className="mx-1.5 text-gray-300" aria-hidden="true">·</span>
        {formatKcalAdjustment(kcalNum)}
      </p>
      <p className="mt-0.5 text-xs text-gray-400">{preset.humanDesc}</p>
    </div>
  );
}

export default memo(GoalSummary);
