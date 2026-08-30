import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { Switch } from '@/components/ui/Switch';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ConfirmSheet } from '@/components/ui/ActionSheet';
import { Icon } from '@/components/ui/Icon';
import { ErrorState } from '@/components/ui/States';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { CalorieModeSheet } from '@/components/ui/CalorieModeSheet';
import { calorieModeShortLabel } from '@/components/ui/calorieModeLabels';
import {
  BodySheet,
  ProteinSheet,
  RemindersSheet,
  SleepNeatSheet,
} from '@/components/profile/ProfileSheets';
import { useMacroPreferences } from '@/hooks/useMacroPreferences';
import { useAuth } from '@/hooks/useAuth';
import { useTheme, type Theme } from '@/hooks/useTheme';
import { useLanguage } from '@/hooks/useLanguage';
import { useUnits } from '@/hooks/useUnits';
import { useCalorieMode } from '@/hooks/useCalorieMode';
import { useSafeguardToggle } from '@/hooks/useSafeguardToggle';
import { useGetStreak, useUpdateStreakSettings, useResetStreak } from '@/hooks/useStreak';
import { usePremium } from '@/hooks/usePremium';
import { useDelayedBoolean } from '@/hooks/useDelayedBoolean';
import { profileService } from '@/services/profileService';
import { dailyLogService } from '@/services/dailyLogService';
import { userService } from '@/services/userService';
import { queryKeys, invalidateDayData } from '@/lib/queryKeys';
import { toDateString, qtyStr, parseDate } from '@/utils/format';
import { profileToRequest } from '@/utils/profile';
import { extractApiError } from '@/utils/apiError';
import { formatWeight } from '@/utils/units';
import { matchPreset, GOAL_PRESETS } from '@/utils/goalUtils';
import { effectiveAutoProteinGrams } from '@/config/proteinPresets';
import { useBodyStaleDays, BODY_VERY_STALE_DAYS } from '@/hooks/useBodyStaleDays';
import { FEATURES } from '@/config/features';
import type { UserProfileRequest } from '@/types';

type OpenSheet = 'body' | 'protein' | 'mode' | 'reminders' | 'sleep-neat' | null;
type ConfirmKind = 'streak-reset' | 'clear-history' | 'delete-account' | 'bmr-review' | null;

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const shortDate = (d: string) =>
    new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }).format(parseDate(d));
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { system, setSystem, weightUnit } = useUnits();
  const { mode, setMode } = useCalorieMode();
  const safeguard = useSafeguardToggle();
  const { data: streak } = useGetStreak();
  const updateStreak = useUpdateStreakSettings();
  const resetStreak = useResetStreak();
  const { isPremium } = usePremium();

  const [sheet, setSheet] = useState<OpenSheet>(null);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  // The review nudge reopens the body sheet with the advanced section shown.
  const [bodyAdvanced, setBodyAdvanced] = useState(false);
  const { data: macroPrefs } = useMacroPreferences();
  const trackedMacroCount = (macroPrefs ?? []).filter((m) => m.isTracked).length;

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => profileService.get().then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });
  const showSkeleton = useDelayedBoolean(profileQuery.isLoading, 300);
  const profile = profileQuery.data;

  const save = useMutation({
    mutationFn: (patch: Partial<UserProfileRequest>) =>
      profileService.update({ ...profileToRequest(profile!), ...patch }).then((r) => r.data),
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.profile(), updated);
      setSheet(null);
      toast('success', t('common.saved', 'Saved'));
      const today = toDateString();
      try {
        await dailyLogService.refreshSnapshot(today);
      } catch {
        /* non-critical */
      }
      // A profile change (weight, goal, safeguard) moves the budget of every
      // day, so every cached dashboard is stale, not just today's.
      invalidateDayData(queryClient);
      dailyLogService
        .refreshStaleSnapshots()
        .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.historyAll() }))
        .catch(() => undefined);
    },
    onError: (err) =>
      toast('error', extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  const clearHistory = useMutation({
    mutationFn: () => userService.clearHistory(),
    onSuccess: () => {
      queryClient.clear();
      setConfirm(null);
      toast('success', t('profile.history_cleared', 'History cleared'));
    },
    onError: (err) => toast('error', extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  const deleteAccount = useMutation({
    mutationFn: () => userService.deleteAccount(),
    onSuccess: () => {
      queryClient.clear();
      logout();
    },
    onError: (err) => toast('error', extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  const goalLabel = (() => {
    if (!profile) return '';
    // A dated target is the most meaningful summary when one is set.
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
  })();

  const proteinTracked = profile
    ? profile.proteinGoalGrams !== null || profile.autoCalculateProteinGoal
    : true;

  const staleDays = useBodyStaleDays();
  const bodyVeryStale = staleDays !== null && staleDays > BODY_VERY_STALE_DAYS;

  /**
   * After a body save: the user changed weight or height but left a MANUAL
   * BMR or body fat untouched. Those numbers were measured at a different
   * body, so offer a review — once, right now, never as a nagging banner.
   */
  const maybeNudgeBmrReview = (patch: Partial<UserProfileRequest>) => {
    if (!profile) return;
    const weightChanged = (patch.currentWeightKg ?? null) !== (profile.currentWeightKg ?? null);
    const heightChanged = (patch.heightCm ?? null) !== (profile.heightCm ?? null);
    if (!weightChanged && !heightChanged) return;

    const manualBmrKept =
      patch.autoCalculateBMR === false &&
      patch.bmrKcal != null &&
      Math.round(patch.bmrKcal) === Math.round(profile.bmrKcal);
    const manualBfKept =
      patch.autoCalculateBodyFat === false &&
      patch.bodyFatPercent != null &&
      profile.bodyFatPercent !== null &&
      patch.bodyFatPercent === profile.bodyFatPercent;

    if (manualBmrKept || manualBfKept) setConfirm('bmr-review');
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[22px] font-extrabold text-ink leading-tight">
          {t('profile.title', 'Profile')}
        </h1>
        {user && <p className="text-[13px] text-ink-2">{user.username}</p>}
      </header>

      {profileQuery.isError && (
        <ErrorState
          title={t('profile.load_error_title', 'Could not load your profile')}
          body={t('profile.load_error_body', 'Check your connection and try again.')}
          retryLabel={t('common.retry', 'Retry')}
          onRetry={() => profileQuery.refetch()}
        />
      )}

      {!profile && !profileQuery.isError && showSkeleton && (
        <>
          <SkeletonCard rows={3} />
          <SkeletonCard rows={3} />
        </>
      )}

      {profile && (
        <>
          {/* Premium entry (hidden while the subscription is disabled in development) */}
          {FEATURES.premium && (
            <Card variant="premium" padded={false}>
              <button
                type="button"
                onClick={() => navigate('/premium')}
                className="pressable w-full flex items-center gap-3 p-4 text-left"
              >
                <span className="w-10 h-10 rounded-2xl bg-premium text-white flex items-center justify-center shrink-0">
                  <Icon name="crown" size={20} />
                </span>
                <span className="flex-1">
                  <span className="block text-[15px] font-bold text-ink">
                    {isPremium
                      ? t('profile.premium_member', 'ArtiCalorias Plus member')
                      : t('profile.premium_cta', 'Try Plus free for 14 days')}
                  </span>
                  <span className="block text-[13px] text-ink-2 mt-0.5">
                    {isPremium
                      ? t('profile.premium_manage', 'Manage your subscription')
                      : t('profile.premium_pitch', 'Weekly insights and deeper analytics')}
                  </span>
                </span>
                <Icon name="chevronRight" size={18} className="text-ink-3" />
              </button>
            </Card>
          )}

          {/* Plan */}
          <section>
            <h2 className="text-[13px] font-bold text-ink-2 uppercase tracking-wide mb-2 px-1">
              {t('profile.section_plan', 'Your plan')}
            </h2>
            <Card padded={false} className="overflow-hidden divide-y divide-hairline/50">
              <ListRow
                icon="target"
                title={t('profile.row_goal', 'Goal')}
                right={goalLabel}
                chevron
                onClick={() => navigate('/profile/goal')}
              />
              <ListRow
                icon="drumstick"
                title={t('profile.row_protein', 'Protein target')}
                right={(() => {
                  if (!proteinTracked) return t('profile.protein_off', 'Off');
                  if (profile.proteinGoalGrams !== null) return `${Math.round(profile.proteinGoalGrams)} g`;
                  const autoGrams = effectiveAutoProteinGrams(
                    profile.currentWeightKg,
                    profile.age,
                    profile.proteinGoalGramsPerKg,
                  );
                  return autoGrams !== null
                    ? t('profile.protein_auto_value', '{{g}} g auto', { g: autoGrams })
                    : t('profile.auto', 'Auto');
                })()}
                chevron
                onClick={() => setSheet('protein')}
              />
              <ListRow
                icon="sliders"
                title={t('profile.row_macros', 'Macro tracking')}
                right={
                  trackedMacroCount + (proteinTracked ? 1 : 0) > 0
                    ? t('profile.macros_tracked_n', '{{n}} tracked', {
                        n: trackedMacroCount + (proteinTracked ? 1 : 0),
                      })
                    : t('profile.macros_none', 'None')
                }
                chevron
                onClick={() => navigate('/profile/macros')}
              />
              <ListRow
                icon="scale"
                iconClassName={bodyVeryStale ? 'bg-warning-soft text-warning' : undefined}
                title={t('profile.row_body', 'Body details')}
                subtitle={
                  bodyVeryStale ? (
                    <span className="text-warning font-semibold">
                      {t('profile.body_stale_subtitle', 'Not updated in over a month')}
                    </span>
                  ) : undefined
                }
                right={
                  profile.currentWeightKg !== null
                    ? formatWeight(profile.currentWeightKg, weightUnit)
                    : t('profile.add', 'Add')
                }
                chevron
                onClick={() => setSheet('body')}
              />
              <ListRow
                icon="moon"
                title={t('profile.row_sleep_neat', 'Sleep & daily movement')}
                right={t('profile.sleep_neat_value', '{{sleep}} h · {{neat}} h', {
                  sleep: qtyStr(profile.sleepHours),
                  neat: qtyStr(profile.neatHours),
                })}
                chevron
                onClick={() => setSheet('sleep-neat')}
              />
              <ListRow
                icon="chart"
                title={t('profile.row_mode', 'Calorie display')}
                right={calorieModeShortLabel(t, mode)}
                chevron
                onClick={() => setSheet('mode')}
              />
            </Card>
          </section>

          {/* Preferences */}
          <section>
            <h2 className="text-[13px] font-bold text-ink-2 uppercase tracking-wide mb-2 px-1">
              {t('profile.section_prefs', 'Preferences')}
            </h2>
            <Card className="space-y-4">
              <div>
                <p className="text-[13px] font-semibold text-ink-2 mb-1.5">
                  {t('profile.appearance', 'Appearance')}
                </p>
                <SegmentedControl<Theme>
                  aria-label={t('profile.appearance', 'Appearance')}
                  options={[
                    { value: 'light', label: t('profile.theme_light', 'Light'), icon: 'sun' },
                    { value: 'system', label: t('profile.theme_system', 'Auto') },
                    { value: 'dark', label: t('profile.theme_dark', 'Dark'), icon: 'moon' },
                  ]}
                  value={theme}
                  onChange={setTheme}
                />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-ink-2 mb-1.5">
                  {t('profile.language', 'Language')}
                </p>
                <SegmentedControl<'en' | 'es'>
                  aria-label={t('profile.language', 'Language')}
                  options={[
                    { value: 'en', label: 'English' },
                    { value: 'es', label: 'Español' },
                  ]}
                  value={language}
                  onChange={setLanguage}
                />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-ink-2 mb-1.5">
                  {t('profile.units', 'Units')}
                </p>
                <SegmentedControl<'metric' | 'imperial'>
                  aria-label={t('profile.units', 'Units')}
                  options={[
                    { value: 'metric', label: t('profile.units_metric', 'Metric (kg, cm)') },
                    { value: 'imperial', label: t('profile.units_imperial', 'Imperial (lbs, ft)') },
                  ]}
                  value={system}
                  onChange={setSystem}
                />
              </div>
            </Card>
          </section>

          {/* Reminders + tracking */}
          <section>
            <h2 className="text-[13px] font-bold text-ink-2 uppercase tracking-wide mb-2 px-1">
              {t('profile.section_tracking', 'Tracking')}
            </h2>
            <Card padded={false} className="overflow-hidden divide-y divide-hairline/50">
              <ListRow
                icon="bell"
                title={t('profile.row_reminders', 'Meal reminders')}
                chevron
                onClick={() => setSheet('reminders')}
              />
              <ListRow
                icon="shield"
                title={t('profile.row_safeguard', 'Minimum calorie safeguard')}
                subtitle={t('profile.safeguard_hint', 'Keeps your budget above a safe floor')}
                right={
                  <Switch
                    checked={safeguard.enabled}
                    onChange={safeguard.setEnabled}
                    disabled={safeguard.isSaving}
                    label={t('profile.row_safeguard', 'Minimum calorie safeguard')}
                  />
                }
              />
              <ListRow
                icon="flame"
                title={t('profile.row_streak', 'Logging streak')}
                subtitle={
                  streak && streak.streakEnabled && streak.currentStreak > 0
                    ? t('profile.streak_current', '{{n}} days and counting', { n: streak.currentStreak })
                    : undefined
                }
                right={
                  <Switch
                    checked={streak?.streakEnabled ?? true}
                    onChange={(on) => updateStreak.mutate({ streakEnabled: on })}
                    disabled={updateStreak.isPending}
                    label={t('profile.row_streak', 'Logging streak')}
                  />
                }
              />
              {streak?.streakEnabled && streak.currentStreak > 0 && (
                <ListRow
                  icon="refresh"
                  title={t('profile.row_streak_reset', 'Reset current streak')}
                  onClick={() => setConfirm('streak-reset')}
                />
              )}
            </Card>
          </section>

          {/* Account */}
          <section>
            <h2 className="text-[13px] font-bold text-ink-2 uppercase tracking-wide mb-2 px-1">
              {t('profile.section_account', 'Account')}
            </h2>
            <Card padded={false} className="overflow-hidden divide-y divide-hairline/50">
              <ListRow
                icon="logout"
                title={t('profile.row_logout', 'Sign out')}
                onClick={() => logout()}
              />
              <ListRow
                icon="trash"
                title={t('profile.row_clear_history', 'Clear all history')}
                subtitle={t('profile.clear_history_hint', 'Removes every logged day, keeps your account')}
                onClick={() => setConfirm('clear-history')}
              />
              <ListRow
                icon="alertTriangle"
                title={<span className="text-danger">{t('profile.row_delete_account', 'Delete account')}</span>}
                onClick={() => setConfirm('delete-account')}
              />
            </Card>
          </section>

          <p className="text-center text-[12px] text-ink-3 pt-1">ArtiCalorias v2.0.0</p>

          {/* Sheets */}
          <BodySheet
            open={sheet === 'body'}
            onClose={() => {
              setSheet(null);
              setBodyAdvanced(false);
            }}
            profile={profile}
            initialAdvanced={bodyAdvanced}
            onSave={(patch) =>
              save.mutate(patch, { onSuccess: () => maybeNudgeBmrReview(patch) })
            }
            saving={save.isPending}
          />
          <ProteinSheet
            open={sheet === 'protein'}
            onClose={() => setSheet(null)}
            profile={profile}
            onSave={(patch) => save.mutate(patch)}
            saving={save.isPending}
          />
          <SleepNeatSheet
            open={sheet === 'sleep-neat'}
            onClose={() => setSheet(null)}
            profile={profile}
            onSave={(patch) => save.mutate(patch)}
            saving={save.isPending}
          />
          <CalorieModeSheet
            open={sheet === 'mode'}
            onClose={() => setSheet(null)}
            mode={mode}
            onPick={(m) => {
              setMode(m);
              toast('success', t('common.saved', 'Saved'));
            }}
          />
          <RemindersSheet open={sheet === 'reminders'} onClose={() => setSheet(null)} />

          <ConfirmSheet
            open={confirm === 'bmr-review'}
            onClose={() => setConfirm(null)}
            title={t('profile.bmr_review_title', 'Review your manual values?')}
            body={t('profile.bmr_review_body', 'Your body details changed, but your BMR or body fat are set manually and stayed the same. Numbers measured at a different weight may be off now.')}
            confirmLabel={t('profile.bmr_review_confirm', 'Review them now')}
            cancelLabel={t('profile.bmr_review_keep', 'Keep them as they are')}
            onConfirm={() => {
              setConfirm(null);
              setBodyAdvanced(true);
              setSheet('body');
            }}
          />
          <ConfirmSheet
            open={confirm === 'streak-reset'}
            onClose={() => setConfirm(null)}
            title={t('profile.streak_reset_title', 'Reset your streak?')}
            body={t('profile.streak_reset_body', 'Your current streak goes back to zero. Your longest streak record stays.')}
            confirmLabel={t('profile.streak_reset_confirm', 'Reset streak')}
            cancelLabel={t('common.cancel', 'Cancel')}
            loading={resetStreak.isPending}
            onConfirm={() =>
              resetStreak.mutate(undefined, {
                onSuccess: () => {
                  setConfirm(null);
                  toast('success', t('profile.streak_reset_done', 'Streak reset'));
                },
              })
            }
          />
          <ConfirmSheet
            open={confirm === 'clear-history'}
            onClose={() => setConfirm(null)}
            title={t('profile.clear_history_title', 'Clear all history?')}
            body={t('profile.clear_history_body', 'Every logged day, meal and activity is permanently removed. Your account, templates and settings stay. This cannot be undone.')}
            confirmLabel={t('profile.clear_history_confirm', 'Clear everything')}
            cancelLabel={t('common.cancel', 'Cancel')}
            loading={clearHistory.isPending}
            onConfirm={() => clearHistory.mutate()}
          />
          <ConfirmSheet
            open={confirm === 'delete-account'}
            onClose={() => setConfirm(null)}
            title={t('profile.delete_account_title', 'Delete your account?')}
            body={t('profile.delete_account_body', 'Your account and all your data are permanently deleted. There is no way back. If you only want a fresh start, clear your history instead.')}
            confirmLabel={t('profile.delete_account_confirm', 'Delete my account forever')}
            cancelLabel={t('common.cancel', 'Cancel')}
            loading={deleteAccount.isPending}
            onConfirm={() => deleteAccount.mutate()}
          />
        </>
      )}
    </div>
  );
}
