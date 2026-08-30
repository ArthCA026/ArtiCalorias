import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button, IconButton } from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { GoalPlanner, type GoalSelection } from '@/components/goal/GoalPlanner';
import { useUnits } from '@/hooks/useUnits';
import { profileService } from '@/services/profileService';
import { dailyLogService } from '@/services/dailyLogService';
import { queryKeys, invalidateDayData } from '@/lib/queryKeys';
import { toDateString } from '@/utils/format';
import { profileToRequest } from '@/utils/profile';
import { extractApiError } from '@/utils/apiError';

/**
 * The goal as its own page (was a bottom sheet): pace presets with their
 * kcal equivalents, a custom pace in either dialect (weight per week or
 * kcal per day), and the target-by-date planner all need room to explain
 * themselves. Same planner component as onboarding, so the two flows can
 * never drift apart. Changes apply from today; past days keep their goals.
 */
export default function GoalPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { weightUnit } = useUnits();
  const [selection, setSelection] = useState<GoalSelection | null>(null);

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => profileService.get().then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });
  const profile = profileQuery.data;

  const save = useMutation({
    mutationFn: (patch: GoalSelection) =>
      profileService.update({ ...profileToRequest(profile!), ...patch }).then((r) => r.data),
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.profile(), updated);
      // Re-freeze today's snapshot so the new goal reaches the ring now;
      // past days keep the goal they were lived under.
      try {
        await dailyLogService.refreshSnapshot(toDateString());
      } catch {
        /* non-critical: the next recalculation refreshes it */
      }
      invalidateDayData(queryClient);
      toast('success', t('goalpage.saved', 'Goal updated. Applies from today.'));
      navigate('/profile');
    },
    onError: (err) =>
      toast('error', extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <IconButton icon="arrowLeft" label={t('common.back', 'Back')} onClick={() => navigate('/profile')} />
        <div className="flex-1 min-w-0">
          <h1 className="text-[19px] font-extrabold text-ink leading-tight">
            {t('profile.goal_title', 'Your goal')}
          </h1>
          <p className="text-[12px] text-ink-2">
            {t('goalpage.subtitle', 'Sets the daily calorie budget everything else builds on')}
          </p>
        </div>
      </header>

      {!profile && <SkeletonCard rows={5} />}

      {profile && (
        <>
          <GoalPlanner
            currentWeightKg={profile.currentWeightKg}
            heightCm={profile.heightCm}
            bodyFatPercent={profile.bodyFatPercent}
            biologicalSex={profile.biologicalSex}
            weightUnit={weightUnit}
            initialGoalKcal={profile.dailyBaseGoalKcal}
            initialTargetWeightKg={profile.goalTargetWeightKg}
            initialTargetBfPercent={profile.goalTargetBodyFatPercent}
            initialTargetDate={profile.goalTargetDate}
            onChange={setSelection}
            optionClassName="bg-card"
          />

          <p className="text-[13px] text-ink-3 leading-relaxed px-1">
            {t('goalpage.applies_hint', 'Applies from today. Past days keep the goal they were lived under.')}
          </p>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={save.isPending}
            disabled={selection === null}
            onClick={() => selection && save.mutate(selection)}
          >
            {t('common.save', 'Save')}
          </Button>
        </>
      )}
    </div>
  );
}
