import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useUnits } from '@/hooks/useUnits';
import { parseDate } from '@/utils/format';
import { formatWeight } from '@/utils/units';
import { GOAL_PRESETS, matchPreset } from '@/utils/goalUtils';
import type { UserProfileResponse } from '@/types';

/** True when the goal is neither a dated target nor one of the presets, so its label is just "Custom". */
export function isCustomGoal(profile: UserProfileResponse | null | undefined): boolean {
  if (!profile || profile.goalTargetDate) return false;
  return matchPreset(String(Math.round(profile.dailyBaseGoalKcal))).isCustom;
}

/**
 * One-line summary of the user's goal ("Lose 0.5 kg a week", "72 kg by 4 Dec",
 * "Custom"), shared by Profile and the subscription paywall. A dated target is
 * the most meaningful summary when one is set; otherwise the matching preset.
 */
export function useGoalLabel() {
  const { t, i18n } = useTranslation();
  const { weightUnit } = useUnits();

  return useCallback(
    (profile: UserProfileResponse | null | undefined): string => {
      if (!profile) return '';

      const shortDate = (d: string) =>
        new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }).format(parseDate(d));

      if (profile.goalTargetDate) {
        if (profile.goalTargetBodyFatPercent !== null)
          return t('profile.goal_target_bf_value', '{{bf}}% by {{date}}', {
            bf: profile.goalTargetBodyFatPercent,
            date: shortDate(profile.goalTargetDate),
          });
        if (profile.goalTargetWeightKg !== null)
          return t('profile.goal_target_weight_value', '{{weight}} by {{date}}', {
            weight: formatWeight(profile.goalTargetWeightKg, weightUnit, 0),
            date: shortDate(profile.goalTargetDate),
          });
      }

      const m = matchPreset(String(Math.round(profile.dailyBaseGoalKcal)));
      if (!m.isCustom) {
        const preset = GOAL_PRESETS.find((p) => p.key === m.preset);
        if (preset) return t(`goal.${preset.key}`, preset.label);
      }
      return t('profile.goal_custom_value', 'Custom');
    },
    [t, i18n.language, weightUnit],
  );
}
