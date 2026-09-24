import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ListRow } from '@/components/ui/ListRow';
import { ErrorState } from '@/components/ui/States';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { TestModeNotice } from '@/components/billing/TestModeNotice';
import { CancelSubscriptionSheet } from '@/components/billing/CancelSubscriptionSheet';
import { useBillingStatus, useResumeSubscription } from '@/hooks/useBilling';
import { useDelayedBoolean } from '@/hooks/useDelayedBoolean';
import { extractApiError } from '@/utils/apiError';
import { formatBillingDate, formatPrice } from '@/utils/billing';
import { cn } from '@/utils/cn';
import type { SubscriptionState } from '@/types';

/**
 * Profile > Subscription. Shows what the user is paying for and when, and
 * lets them stop in two taps: the button, then one confirmation that says
 * plainly what happens next. Leaving is exactly as easy as joining, with no
 * detour through offers or guilt, and a cancellation can be undone just as
 * simply until it takes effect.
 */

const stateTone: Record<SubscriptionState, { chip: string; icon: IconName }> = {
  active: { chip: 'bg-success-soft text-success', icon: 'checkCircle' },
  canceling: { chip: 'bg-warning-soft text-warning', icon: 'clock' },
  past_due: { chip: 'bg-danger-soft text-danger', icon: 'alertTriangle' },
  ended: { chip: 'bg-inset text-ink-2', icon: 'info' },
};

export default function SubscriptionPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const billing = useBillingStatus();
  const resume = useResumeSubscription();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const showSkeleton = useDelayedBoolean(billing.isLoading, 300);

  const header = (
    <header className="flex items-center gap-1 -ml-2">
      <IconButton icon="arrowLeft" label={t('common.back', 'Back')} onClick={() => navigate('/profile')} />
      <h1 className="text-[22px] font-extrabold text-ink leading-tight">
        {t('billing.manage_title', 'Subscription')}
      </h1>
    </header>
  );

  if (billing.isLoading) {
    return (
      <div className="space-y-4">
        {header}
        {showSkeleton && <SkeletonCard rows={3} />}
      </div>
    );
  }

  if (billing.isError || !billing.data) {
    return (
      <div className="space-y-4">
        {header}
        <ErrorState
          title={t('billing.status_error_title', 'Could not check your subscription')}
          body={t('billing.status_error_body', 'Check your connection and try again.')}
          retryLabel={t('common.retry', 'Retry')}
          onRetry={() => billing.refetch()}
        />
      </div>
    );
  }

  const status = billing.data;
  const sub = status.subscription;

  // Subscriptions switched off on the server and nothing to manage.
  if (!status.billingEnabled && !sub) return <Navigate to="/profile" replace />;

  const date = (iso: string | null | undefined) => formatBillingDate(iso, i18n.language);
  const priceLabel = sub ? formatPrice(sub.priceCents, sub.currency, i18n.language) : '';
  const yearly = sub?.plan === 'yearly';
  const live = sub !== null && sub.state !== 'ended';

  const stateLabel: Record<SubscriptionState, string> = {
    active: t('billing.state_active', 'Active'),
    canceling: t('billing.state_canceling', 'Cancelled'),
    past_due: t('billing.state_past_due', 'Payment failed'),
    ended: t('billing.state_ended', 'Ended'),
  };

  const onResume = () =>
    resume.mutate(undefined, {
      onSuccess: () => toast('success', t('billing.resumed_toast', 'Welcome back. Your subscription will renew as usual.')),
      onError: (err) =>
        toast('error', extractApiError(err, t('billing.resume_error', 'Could not resume right now. Please try again in a moment.'))),
    });

  return (
    <div className="space-y-4">
      {header}

      {status.mode === 'test' && <TestModeNotice />}

      {status.accessReason === 'whitelist' && (
        <Card variant="soft" className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-2xl bg-card text-primary-soft-ink flex items-center justify-center shrink-0">
            <Icon name="gift" size={20} />
          </span>
          <div>
            <p className="text-[15px] font-bold text-primary-soft-ink">
              {t('billing.complimentary_title', 'Complimentary access')}
            </p>
            <p className="mt-0.5 text-[13px] text-primary-soft-ink/90 leading-relaxed">
              {live
                ? t('billing.complimentary_with_sub', 'This account can use ArtiCalorias without paying. You also have the subscription below, which you can cancel at any time.')
                : t('billing.complimentary_body', 'This account can use ArtiCalorias without a subscription. There is nothing to pay and nothing to cancel.')}
            </p>
          </div>
        </Card>
      )}

      {sub && (
        <>
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-ink-2">{t('billing.your_plan', 'Your plan')}</p>
                <p className="mt-0.5 text-xl font-extrabold text-ink leading-tight">
                  {yearly ? t('billing.plan_yearly', 'Yearly') : t('billing.plan_monthly', 'Monthly')}
                </p>
                <p className="mt-0.5 text-[14px] text-ink-2 tabular-nums">
                  {priceLabel} {yearly ? t('billing.per_year', 'per year') : t('billing.per_month', 'per month')}
                </p>
              </div>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold shrink-0',
                  stateTone[sub.state].chip,
                )}
              >
                <Icon name={stateTone[sub.state].icon} size={13} />
                {stateLabel[sub.state]}
              </span>
            </div>

            {sub.state === 'canceling' && (
              <div className="mt-4">
                <p className="text-[14px] text-ink-2 leading-relaxed">
                  {t(
                    'billing.canceling_body',
                    'You keep full access until {{date}} and you will not be charged again. After that the app locks, and everything you logged stays saved for when you come back.',
                    { date: date(sub.accessUntilUtc) },
                  )}
                </p>
                {sub.canResume ? (
                  <Button variant="primary" size="lg" fullWidth className="mt-3.5" loading={resume.isPending} onClick={onResume}>
                    {t('billing.resume_cta', 'Keep my subscription')}
                  </Button>
                ) : (
                  <p className="mt-2 text-[13px] text-ink-3">
                    {t('billing.resume_unavailable', 'You can subscribe again once it ends.')}
                  </p>
                )}
              </div>
            )}

            {sub.state === 'past_due' && (
              <div className="mt-4">
                <p className="text-[14px] text-ink-2 leading-relaxed">
                  {t(
                    'billing.past_due_body',
                    'We could not charge your card for the renewal. Pay with another card by {{date}} to keep your access. Your data is safe either way.',
                    { date: date(sub.accessUntilUtc) },
                  )}
                </p>
                <Button variant="primary" size="lg" fullWidth className="mt-3.5" onClick={() => navigate('/subscribe', { state: { from: '/profile/subscription' } })}>
                  {t('billing.cta_fix', 'Pay with another card')}
                </Button>
              </div>
            )}
          </Card>

          <Card padded={false} className="overflow-hidden divide-y divide-hairline/50">
            {sub.state === 'active' && (
              <ListRow
                icon="calendar"
                title={t('billing.row_next_charge', 'Next charge')}
                subtitle={t('billing.row_next_charge_hint', '{{price}}, charged automatically', { price: priceLabel })}
                right={date(sub.paidThroughUtc)}
              />
            )}
            {sub.state === 'canceling' && (
              <ListRow icon="calendar" title={t('billing.row_access_until', 'Access until')} right={date(sub.accessUntilUtc)} />
            )}
            {sub.state === 'ended' && (
              <ListRow icon="calendar" title={t('billing.row_ended_on', 'Ended on')} right={date(sub.paidThroughUtc)} />
            )}
            <ListRow icon="clock" title={t('billing.row_since', 'Subscribed since')} right={date(sub.startedAtUtc)} />
            <ListRow
              icon="lock"
              title={t('billing.row_payment', 'Payment')}
              subtitle={t('billing.row_payment_hint', 'Card details are kept by ONVO Pay, never by ArtiCalorias')}
            />
          </Card>
        </>
      )}

      {!sub && status.accessReason !== 'whitelist' && (
        <Card>
          <p className="text-[15px] font-bold text-ink">{t('billing.none_title', 'No subscription yet')}</p>
          <p className="mt-1 text-[14px] text-ink-2 leading-relaxed">
            {t('billing.none_body', 'There is no subscription on this account.')}
          </p>
        </Card>
      )}

      {/* Only while it renews: a cancelled or past-due plan has no "date shown above". */}
      {sub?.state === 'active' && (
        <section>
          <h2 className="text-[13px] font-bold text-ink-2 uppercase tracking-wide mb-2 px-1">
            {t('billing.how_title', 'How billing works')}
          </h2>
          <Card className="space-y-2.5">
            {[
              t('billing.how_renews', 'Your plan renews by itself on the date shown above, at the same price.'),
              t('billing.how_cancel', 'Cancel anytime. You keep access until the end of the period you already paid for.'),
              t('billing.how_switch', 'To switch between monthly and yearly, cancel and subscribe again when the current period ends.'),
              t('billing.how_prices', 'If the price ever changes, you are told in advance and it only applies from a later renewal.'),
            ].map((line, i) => (
              <p key={i} className="flex items-start gap-2.5 text-[13px] text-ink-2 leading-relaxed">
                <Icon name="check" size={15} className="mt-0.5 shrink-0 text-primary" />
                <span>{line}</span>
              </p>
            ))}
            <button
              type="button"
              onClick={() => navigate('/legal/terms')}
              className="pressable text-[13px] font-semibold text-primary-soft-ink underline underline-offset-2"
            >
              {t('billing.read_terms', 'Read the subscription terms')}
            </button>
          </Card>
        </section>
      )}

      {sub && (sub.state === 'active' || sub.state === 'past_due') && (
        <Button variant="ghost" size="md" fullWidth className="text-danger" onClick={() => setConfirmCancel(true)}>
          {t('billing.cancel_cta', 'Cancel subscription')}
        </Button>
      )}

      <CancelSubscriptionSheet open={confirmCancel} onClose={() => setConfirmCancel(false)} />
    </div>
  );
}
