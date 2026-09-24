import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { Switch } from '@/components/ui/Switch';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ConfirmSheet } from '@/components/ui/ActionSheet';
import { iconOrFallback } from '@/components/ui/Icon';
import { ErrorState } from '@/components/ui/States';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { CalorieModeSheet } from '@/components/ui/CalorieModeSheet';
import { calorieModeShortLabel } from '@/components/ui/calorieModeLabels';
import { BodySheet, RemindersSheet, SleepNeatSheet } from '@/components/profile/ProfileSheets';
import { MacroTargetSheet } from '@/components/profile/MacroTargetSheet';
import { ConsentStatusSheet, WithdrawConsentSheet } from '@/components/profile/LegalSheets';
import { Spinner } from '@/components/ui/Button';
import { consentService } from '@/services/consentService';
import { POLICY_VERSIONS } from '@/legal/policyVersions';
import { useMacros } from '@/hooks/useMacros';
import { useMacroPreferences, useUpdateMacroPreference } from '@/hooks/useMacroPreferences';
import { useAuth } from '@/hooks/useAuth';
import { useTheme, type Theme } from '@/hooks/useTheme';
import { useLanguage } from '@/hooks/useLanguage';
import { useUnits } from '@/hooks/useUnits';
import { useCalorieMode } from '@/hooks/useCalorieMode';
import { useSafeguardToggle } from '@/hooks/useSafeguardToggle';
import { useGetStreak, useUpdateStreakSettings, useResetStreak } from '@/hooks/useStreak';
import { useBillingStatus } from '@/hooks/useBilling';
import { useGoalLabel } from '@/hooks/useGoalLabel';
import { useDelayedBoolean } from '@/hooks/useDelayedBoolean';
import { profileService } from '@/services/profileService';
import { dailyLogService } from '@/services/dailyLogService';
import { userService } from '@/services/userService';
import { queryKeys, invalidateDayData } from '@/lib/queryKeys';
import { toDateString, qtyStr } from '@/utils/format';
import { profileToRequest } from '@/utils/profile';
import { extractApiError } from '@/utils/apiError';
import { formatWeight } from '@/utils/units';
import { formatMacroAmount } from '@/utils/macros';
import { useBodyStaleDays, BODY_VERY_STALE_DAYS } from '@/hooks/useBodyStaleDays';
import { deleteAccountBody } from '@/components/billing/billingCopy';
import { formatBillingDate } from '@/utils/billing';
import type { MacroPreference, UserProfileRequest } from '@/types';

type OpenSheet = 'body' | 'protein' | 'mode' | 'reminders' | 'sleep-neat' | 'consent-status' | 'withdraw-consent' | null;
type ConfirmKind = 'streak-reset' | 'clear-history' | 'delete-account' | 'bmr-review' | null;

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
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
  const billing = useBillingStatus();
  const goalLabelOf = useGoalLabel();

  const [sheet, setSheet] = useState<OpenSheet>(null);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  // The review nudge reopens the body sheet with the advanced section shown.
  const [bodyAdvanced, setBodyAdvanced] = useState(false);
  const { get, maxTracked: maxTrackedMacros } = useMacros();
  const { data: macroPrefs } = useMacroPreferences();
  const updatePref = useUpdateMacroPreference();
  // Protein is one preference among the others now, so it is inside the count.
  const trackedMacroCount = (macroPrefs ?? []).filter((m) => m.isTracked).length;
  const proteinDef = get('protein');
  // No stored row yet (fresh account, preferences still loading): the catalog
  // default, tracked and auto, is what the server would answer anyway.
  const proteinPref: MacroPreference = (macroPrefs ?? []).find((p) => p.macroKey === 'protein') ?? {
    macroKey: 'protein',
    isTracked: true,
    targetMode: 'auto',
    customTargetValue: null,
    autoParam: proteinDef.targetFormula.defaultParam,
    autoTargetValue: null,
    effectiveTarget: null,
    direction: 'hit',
  };

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

  const revokeHealthConsent = () =>
    consentService.record({
      consents: [{ consentType: 'health_data', policyVersion: POLICY_VERSIONS.health_data, action: 'revoked' }],
      locale: language,
      source: 'profile',
    });

  // Ley 8968 revocation, withdraw-only path: the revocation row is appended,
  // then the session ends. Next sign-in lands on the consent gate.
  const withdrawOnly = useMutation({
    mutationFn: () => revokeHealthConsent(),
    onSuccess: () => {
      queryClient.clear();
      logout();
    },
    onError: (err) => toast('error', extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  // Withdraw-and-delete: revocation is recorded first so the audit trail
  // shows the withdrawal even though the account (and the trail) is erased
  // right after. Order matters for the brief window between the two calls.
  const withdrawAndDelete = useMutation({
    mutationFn: async () => {
      await revokeHealthConsent();
      await userService.deleteAccount();
    },
    onSuccess: () => {
      queryClient.clear();
      logout();
    },
    onError: (err) => toast('error', extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
  });

  const exportData = useMutation({
    mutationFn: () => userService.exportData().then((r) => r.data),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `articalorias-data-${toDateString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('success', t('legal.export_done', 'Your data file is downloading'));
    },
    onError: (err) =>
      toast('error', extractApiError(err, t('legal.export_error', 'Could not prepare your data. Check your connection and try again.'))),
  });

  const goalLabel = goalLabelOf(profile);

  const proteinLabel = (() => {
    if (!proteinPref.isTracked) return t('profile.protein_off', 'Off');
    if (proteinPref.targetMode === 'custom' && proteinPref.customTargetValue !== null)
      return formatMacroAmount(proteinDef, proteinPref.customTargetValue);
    if (proteinPref.autoTargetValue !== null)
      return t('profile.protein_auto_value', '{{g}} g auto', { g: Math.round(proteinPref.autoTargetValue) });
    return t('profile.auto', 'Auto');
  })();

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

  // Subscription entry. Hidden only when the server has subscriptions switched
  // off AND this account has none to manage.
  const billingStatus = billing.data;
  const sub = billingStatus?.subscription ?? null;
  const subscriptionRow = billingStatus && (billingStatus.billingEnabled || sub) ? (
    <ListRow
      icon="creditCard"
      iconClassName={sub?.state === 'past_due' ? 'bg-warning-soft text-warning' : undefined}
      title={t('billing.manage_title', 'Subscription')}
      subtitle={
        sub?.state === 'active' ? (
          t('billing.profile_renews', 'Renews on {{date}}', { date: formatBillingDate(sub.paidThroughUtc, i18n.language) })
        ) : sub?.state === 'canceling' ? (
          <span className="text-warning font-semibold">
            {t('billing.profile_ends', 'Ends on {{date}}', { date: formatBillingDate(sub.accessUntilUtc, i18n.language) })}
          </span>
        ) : sub?.state === 'past_due' ? (
          <span className="text-warning font-semibold">
            {t('billing.profile_past_due', 'Payment failed. Tap to fix it')}
          </span>
        ) : undefined
      }
      right={
        sub && sub.state !== 'ended'
          ? sub.plan === 'yearly'
            ? t('billing.plan_yearly', 'Yearly')
            : t('billing.plan_monthly', 'Monthly')
          : billingStatus.accessReason === 'whitelist'
            ? t('billing.profile_complimentary', 'Complimentary')
            : undefined
      }
      chevron
      onClick={() => navigate('/profile/subscription')}
    />
  ) : null;

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
                icon={iconOrFallback(proteinDef.icon)}
                title={t('profile.row_protein', 'Protein target')}
                right={proteinLabel}
                chevron
                onClick={() => setSheet('protein')}
              />
              <ListRow
                icon="sliders"
                title={t('profile.row_macros', 'Macro tracking')}
                right={
                  trackedMacroCount > 0
                    ? Number.isFinite(maxTrackedMacros)
                      ? t('profile.macros_tracked_of', '{{n}} of {{max}} tracked', {
                          n: trackedMacroCount,
                          max: maxTrackedMacros,
                        })
                      : t('profile.macros_tracked_n', '{{n}} tracked', { n: trackedMacroCount })
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

          {/* Legal (Ley 8968: policies, consent state, data export) */}
          <section>
            <h2 className="text-[13px] font-bold text-ink-2 uppercase tracking-wide mb-2 px-1">
              {t('legal.section', 'Legal')}
            </h2>
            <Card padded={false} className="overflow-hidden divide-y divide-hairline/50">
              <ListRow
                icon="shield"
                title={t('legal.row_privacy', 'Privacy notice')}
                chevron
                onClick={() => navigate('/legal/privacy')}
              />
              <ListRow
                icon="fileText"
                title={t('legal.row_terms', 'Terms of use')}
                chevron
                onClick={() => navigate('/legal/terms')}
              />
              <ListRow
                icon="shieldCheck"
                title={t('legal.row_consent', 'Consent and your data')}
                subtitle={t('legal.row_consent_hint', 'See or withdraw what you have agreed to')}
                chevron
                onClick={() => setSheet('consent-status')}
              />
              <ListRow
                icon="download"
                title={t('legal.row_export', 'Download my data')}
                subtitle={t('legal.row_export_hint', 'Everything in your account, as one file')}
                right={exportData.isPending ? <Spinner size={18} /> : undefined}
                onClick={() => {
                  if (!exportData.isPending) exportData.mutate();
                }}
              />
            </Card>
          </section>

          {/* Account */}
          <section>
            <h2 className="text-[13px] font-bold text-ink-2 uppercase tracking-wide mb-2 px-1">
              {t('profile.section_account', 'Account')}
            </h2>
            <Card padded={false} className="overflow-hidden divide-y divide-hairline/50">
              {subscriptionRow}
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
          <MacroTargetSheet
            open={sheet === 'protein'}
            onClose={() => setSheet(null)}
            def={proteinDef}
            pref={proteinPref}
            profile={profile}
            saving={updatePref.isPending}
            onSave={(item) =>
              updatePref.mutate(item, {
                onSuccess: () => {
                  setSheet(null);
                  toast('success', t('macros.saved', 'Tracking updated. Applies from today.'));
                },
                onError: (err) =>
                  toast('error', extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.'))),
              })
            }
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
          <ConsentStatusSheet
            open={sheet === 'consent-status'}
            onClose={() => setSheet(null)}
            onWithdraw={() => setSheet('withdraw-consent')}
          />
          <WithdrawConsentSheet
            open={sheet === 'withdraw-consent'}
            onClose={() => setSheet(null)}
            withdrawing={withdrawOnly.isPending}
            deleting={withdrawAndDelete.isPending}
            onWithdrawOnly={() => withdrawOnly.mutate()}
            onWithdrawAndDelete={() => withdrawAndDelete.mutate()}
          />

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
            body={deleteAccountBody(t, billing.data)}
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
