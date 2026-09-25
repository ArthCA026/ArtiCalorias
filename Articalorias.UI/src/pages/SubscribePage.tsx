import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button, IconButton, Spinner } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ErrorState } from '@/components/ui/States';
import { PasswordConfirmSheet } from '@/components/profile/PasswordConfirmSheet';
import { useToast } from '@/components/ui/Toast';
import { PlanPicker } from '@/components/billing/PlanPicker';
import { CheckoutSheet } from '@/components/billing/CheckoutSheet';
import { TestModeNotice } from '@/components/billing/TestModeNotice';
import { deleteAccountBody } from '@/components/billing/billingCopy';
import { GuardSplash } from '@/app/guards';
import { useAuth } from '@/hooks/useAuth';
import { useBillingStatus, useSyncBilling } from '@/hooks/useBilling';
import { isCustomGoal, useGoalLabel } from '@/hooks/useGoalLabel';
import { profileService } from '@/services/profileService';
import { userService } from '@/services/userService';
import { queryKeys } from '@/lib/queryKeys';
import { extractApiError, extractApiErrorCode } from '@/utils/apiError';
import { findPlan, formatBillingDate, formatPrice } from '@/utils/billing';
import { toDateString } from '@/utils/format';
import type { BillingPlanCode, BillingStatus } from '@/types';

/**
 * The paywall. ArtiCalorias is subscription-only, so this is the gate between
 * onboarding and the app, and where a lapsed subscriber lands.
 *
 * It persuades with things that are true:
 *  - endowed progress: the plan the user just built is shown as ready, waiting;
 *  - loss aversion: a returning user sees how much real history is saved;
 *  - anchoring + smart default: see PlanPicker;
 *  - risk reversal: cancel anytime, and it says exactly how.
 * No invented member counts, ratings, testimonials or countdowns. The honest
 * exits stay one tap away: sign out, download your data, delete the account.
 * None of them needs a subscription.
 */

const BENEFITS: Array<{ icon: IconName; key: string; fallback: string }> = [
  { icon: 'camera', key: 'billing.benefit_log', fallback: 'Log a meal from a photo, a sentence or a barcode' },
  { icon: 'chart', key: 'billing.benefit_budget', fallback: 'A weekly budget that adapts to how your days really go' },
  { icon: 'sliders', key: 'billing.benefit_macros', fallback: 'Protein and the macros you choose, tracked your way' },
  { icon: 'trendingUp', key: 'billing.benefit_progress', fallback: 'Weight and body progress you can see over time' },
  { icon: 'bookmark', key: 'billing.benefit_templates', fallback: 'Templates and routines that log your usual meals in one tap' },
];

export default function SubscribePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { logout } = useAuth();
  const goalLabelOf = useGoalLabel();

  const billing = useBillingStatus();
  const sync = useSyncBilling();
  const [selected, setSelected] = useState<BillingPlanCode>('yearly');
  const [checkoutPlan, setCheckoutPlan] = useState<BillingPlanCode | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // The profile is open to accounts without a subscription (onboarding fills it).
  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () => profileService.get().then((r) => r.data),
    staleTime: 10 * 60 * 1000,
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

  const [deletePasswordError, setDeletePasswordError] = useState<string | null>(null);
  const deleteAccount = useMutation({
    mutationFn: (password: string) => userService.deleteAccount(password),
    onSuccess: () => {
      queryClient.clear();
      logout();
    },
    onError: (err) => {
      if (extractApiErrorCode(err) === 'INVALID_PASSWORD') {
        setDeletePasswordError(t('profile.password_wrong', 'That password is incorrect.'));
        return;
      }
      setConfirmDelete(false);
      toast('error', extractApiError(err, t('log.save_error', 'Could not save. Check your connection and try again.')));
    },
  });

  const from = (location.state as { from?: string } | null)?.from ?? '/today';

  const enter = (status: BillingStatus) => {
    queryClient.setQueryData(queryKeys.billing(), status);
    setCheckoutPlan(null);
    toast('success', t('billing.welcome_toast', 'You are in. Your subscription is active.'));
    navigate(from, { replace: true });
  };

  if (billing.isLoading) return <GuardSplash />;

  if (billing.isError || !billing.data) {
    return (
      <main className="mx-auto max-w-md min-h-dvh px-5 pt-10 pt-safe">
        <ErrorState
          title={t('billing.status_error_title', 'Could not check your subscription')}
          body={t('billing.status_error_body', 'Check your connection and try again.')}
          retryLabel={t('common.retry', 'Retry')}
          onRetry={() => billing.refetch()}
        />
        <button
          type="button"
          className="pressable block mx-auto mt-6 text-[13px] font-semibold text-ink-3"
          onClick={() => logout()}
        >
          {t('profile.row_logout', 'Sign out')}
        </button>
      </main>
    );
  }

  const status = billing.data;

  // Already in (paid, whitelisted, or billing switched off): nothing to sell.
  if (status.hasAccess && status.accessReason !== 'grace') return <Navigate to={from} replace />;

  const previous = status.subscription;
  const inGrace = status.hasAccess && status.accessReason === 'grace';
  const paymentFailed = inGrace || previous?.endedByPaymentFailure === true;
  const returning = previous !== null && !paymentFailed;

  const plan = findPlan(status.plans, selected) ?? status.plans[0];
  const checkout = checkoutPlan ? (findPlan(status.plans, checkoutPlan) ?? null) : null;
  const goalLabel = goalLabelOf(profileQuery.data);
  const daysLogged = status.daysLogged ?? 0;

  const headline = paymentFailed
    ? t('billing.headline_failed', 'Your payment did not go through')
    : returning
      ? t('billing.headline_returning', 'Welcome back')
      : t('billing.headline_new', 'Your plan is ready');

  const subhead = paymentFailed
    ? inGrace
      ? t('billing.sub_failed_grace', 'We could not renew your subscription. Pay with another card by {{date}} to keep your access.', {
          date: formatBillingDate(previous?.accessUntilUtc, i18n.language),
        })
      : t('billing.sub_failed', 'We could not renew your subscription, so your access is paused. Pay with another card to pick up where you left off.')
    : returning
      ? t('billing.sub_returning', 'Your subscription ended on {{date}}. Subscribe again to pick up where you left off.', {
          date: formatBillingDate(previous?.paidThroughUtc, i18n.language),
        })
      : t('billing.sub_new', 'ArtiCalorias works with a subscription. Start yours to begin tracking with the plan you just built.');

  return (
    <main className="mx-auto max-w-md min-h-dvh px-5 pt-6 pt-safe pb-56">
      <div className="space-y-4">
        {/* Still inside the grace window: this screen is a choice, not a wall. */}
        {inGrace && (
          <IconButton
            icon="arrowLeft"
            label={t('common.back', 'Back')}
            className="-ml-2"
            onClick={() => navigate(from, { replace: true })}
          />
        )}

        {status.mode === 'test' && <TestModeNotice />}

        <header>
          <div
            className={
              paymentFailed
                ? 'w-12 h-12 rounded-2xl bg-warning-soft text-warning flex items-center justify-center'
                : 'w-12 h-12 rounded-2xl bg-primary-soft text-primary-soft-ink flex items-center justify-center'
            }
          >
            <Icon name={paymentFailed ? 'alertTriangle' : returning ? 'heart' : 'checkCircle'} size={24} />
          </div>
          <h1 className="mt-3 text-2xl font-extrabold text-ink leading-tight">{headline}</h1>
          <p className="mt-1.5 text-[15px] text-ink-2 leading-relaxed">{subhead}</p>
        </header>

        {/* What is already theirs and waiting behind the gate. Real data only. */}
        {(goalLabel || daysLogged > 0) && (
          <Card variant="soft" className="space-y-2">
            {goalLabel && (
              <p className="flex items-center gap-2.5 text-[14px] font-semibold text-primary-soft-ink">
                <Icon name="target" size={17} className="shrink-0" />
                <span>
                  {isCustomGoal(profileQuery.data)
                    ? t('billing.ready_goal_custom', 'Your personal goal is set')
                    : t('billing.ready_goal', 'Your goal: {{goal}}', { goal: goalLabel })}
                </span>
              </p>
            )}
            {daysLogged > 0 && (
              <p className="flex items-center gap-2.5 text-[14px] font-semibold text-primary-soft-ink">
                <Icon name="calendarCheck" size={17} className="shrink-0" />
                <span>
                  {daysLogged === 1
                    ? t('billing.ready_history_one', '1 logged day, saved and waiting for you')
                    : t('billing.ready_history_n', '{{n}} logged days, saved and waiting for you', { n: daysLogged })}
                </span>
              </p>
            )}
          </Card>
        )}

        <section aria-label={t('billing.benefits_aria', 'What is included')}>
          <Card padded={false} className="py-1.5">
            {BENEFITS.map((b) => (
              <div key={b.key} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-8 h-8 rounded-xl bg-primary-soft text-primary-soft-ink flex items-center justify-center shrink-0">
                  <Icon name={b.icon} size={16} />
                </span>
                <span className="text-[14px] font-semibold text-ink leading-snug">{t(b.key, b.fallback)}</span>
              </div>
            ))}
          </Card>
        </section>

        <PlanPicker plans={status.plans} value={selected} onChange={setSelected} disabled={!status.checkoutAvailable} />

        {!status.checkoutAvailable && (
          <p role="alert" className="rounded-card bg-warning-soft px-4 py-3 text-[13px] text-ink leading-snug">
            {t('billing.unavailable', 'Payments are temporarily unavailable. Please try again later. Nothing will be charged in the meantime.')}
          </p>
        )}

        {/* Honest exits. None of them needs a subscription. */}
        <div className="pt-4 flex flex-col items-center gap-3">
          <button
            type="button"
            className="pressable inline-flex items-center gap-2 text-[13px] font-semibold text-primary-soft-ink"
            disabled={sync.isPending}
            onClick={() =>
              sync.mutate(undefined, {
                onSuccess: (s) => {
                  if (s.hasAccess && s.accessReason !== 'grace') enter(s);
                  else toast('info', t('billing.refresh_none', 'No active subscription was found for this account.'));
                },
                onError: (err) =>
                  toast('error', extractApiError(err, t('billing.refresh_error', 'Could not check right now. Please try again in a moment.'))),
              })
            }
          >
            {sync.isPending ? <Spinner size={14} /> : <Icon name="refresh" size={14} />}
            {t('billing.refresh', 'Already paid? Refresh status')}
          </button>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[13px] font-semibold text-ink-3 whitespace-nowrap">
            <button type="button" className="pressable" onClick={() => navigate('/legal/terms')}>
              {t('legal.row_terms', 'Terms of use')}
            </button>
            <button type="button" className="pressable" onClick={() => navigate('/legal/privacy')}>
              {t('legal.row_privacy', 'Privacy notice')}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[13px] font-semibold text-ink-3 whitespace-nowrap">
            <button type="button" className="pressable" onClick={() => logout()}>
              {t('profile.row_logout', 'Sign out')}
            </button>
            <button
              type="button"
              className="pressable inline-flex items-center gap-1.5"
              disabled={exportData.isPending}
              onClick={() => exportData.mutate()}
            >
              {exportData.isPending && <Spinner size={13} />}
              {t('legal.row_export', 'Download my data')}
            </button>
            <button type="button" className="pressable text-danger" onClick={() => setConfirmDelete(true)}>
              {t('profile.row_delete_account', 'Delete account')}
            </button>
          </div>
        </div>
      </div>

      {/* Primary action pinned in thumb reach, with the price next to it. */}
      <div className="fixed inset-x-0 bottom-0 z-30 bg-app/95 backdrop-blur">
        <div
          className="mx-auto max-w-md px-5 pt-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
        >
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!status.checkoutAvailable || !plan}
            onClick={() => plan && setCheckoutPlan(plan.code)}
          >
            {paymentFailed
              ? t('billing.cta_fix', 'Pay with another card')
              : returning
                ? t('billing.cta_returning', 'Subscribe again')
                : t('billing.cta_new', 'Continue')}
          </Button>
          {plan && (
            <p className="mt-2 text-center text-[12px] text-ink-2 leading-snug">
              {plan.interval === 'year'
                ? t('billing.cta_note_yearly', '{{price}} today, then every year. Cancel anytime.', {
                    price: formatPrice(plan.priceCents, plan.currency, i18n.language),
                  })
                : t('billing.cta_note_monthly', '{{price}} today, then every month. Cancel anytime.', {
                    price: formatPrice(plan.priceCents, plan.currency, i18n.language),
                  })}
            </p>
          )}
        </div>
      </div>

      <CheckoutSheet plan={checkout} onClose={() => setCheckoutPlan(null)} onActivated={enter} />

      <PasswordConfirmSheet
        open={confirmDelete}
        onClose={() => {
          setConfirmDelete(false);
          setDeletePasswordError(null);
        }}
        title={t('profile.delete_account_title', 'Delete your account?')}
        body={deleteAccountBody(t, status)}
        confirmLabel={t('profile.delete_account_confirm', 'Delete my account forever')}
        loading={deleteAccount.isPending}
        error={deletePasswordError}
        onConfirm={(password) => deleteAccount.mutate(password)}
      />
    </main>
  );
}
