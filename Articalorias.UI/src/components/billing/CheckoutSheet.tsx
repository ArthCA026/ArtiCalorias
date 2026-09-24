import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { Button, Spinner } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { InlineError } from '@/components/ui/States';
import { PolicySheet } from '@/components/legal/PolicySheet';
import { TestModeNotice } from './TestModeNotice';
import { useLanguage } from '@/hooks/useLanguage';
import { billingService } from '@/services/billingService';
import { loadOnvoSdk, type OnvoSdkError } from '@/lib/onvoSdk';
import { POLICY_VERSIONS } from '@/legal/policyVersions';
import { extractApiError, extractApiErrorCode } from '@/utils/apiError';
import { formatPrice } from '@/utils/billing';
import type { BillingPlan, BillingStatus } from '@/types';

interface CheckoutSheetProps {
  /** The plan being bought; null = closed. */
  plan: BillingPlan | null;
  onClose: () => void;
  /** The server confirmed a paid subscription. */
  onActivated: (status: BillingStatus) => void;
}

/**
 * Payment sheet. The card form inside it is ONVO's own (their SDK renders it
 * in place): card details go from the browser straight to ONVO and never
 * touch ArtiCalorias.
 *
 * What is about to happen is spelled out ABOVE the form, before any card
 * field: the amount, that it renews, how often, and how to stop it. That is
 * both the honest thing to do and what auto-renewal rules ask for.
 */
export function CheckoutSheet({ plan, onClose, onActivated }: CheckoutSheetProps) {
  const { t } = useTranslation();
  const [locked, setLocked] = useState(false);

  return (
    <Sheet
      open={plan !== null}
      onClose={onClose}
      title={t('billing.checkout_title', 'Secure payment')}
      dismissible={!locked}
    >
      {/* Mounted per opening: every checkout starts from a clean state. */}
      {plan && <CheckoutFlow plan={plan} onActivated={onActivated} onLockChange={setLocked} />}
    </Sheet>
  );
}

type Phase = 'starting' | 'form' | 'verifying' | 'slow' | 'start-error' | 'sdk-error';

const FORM_ID = 'onvo-checkout-form';
const VERIFY_ATTEMPTS = 8;

/** One checkout attempt. Async steps stop touching state once it is no longer alive. */
interface Run {
  alive: boolean;
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/** Paid means paid: a grace window is access too, but it is not a confirmed payment. */
const isPaid = (status: BillingStatus) => status.hasAccess && status.accessReason !== 'grace';

function CheckoutFlow({
  plan,
  onActivated,
  onLockChange,
}: {
  plan: BillingPlan;
  onActivated: (status: BillingStatus) => void;
  onLockChange: (locked: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const { language } = useLanguage();
  const [phase, setPhase] = useState<Phase>('starting');
  const [attempt, setAttempt] = useState(0);
  const [startError, setStartError] = useState<string | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Every async step checks its run is still alive: closing the sheet,
  // retrying, or StrictMode's double mount must not let a stale callback
  // render a second form or flip the phase.
  const currentRun = useRef<Run | null>(null);
  const callbacks = useRef({ onActivated, onLockChange });
  useEffect(() => {
    callbacks.current = { onActivated, onLockChange };
  });

  const priceLabel = formatPrice(plan.priceCents, plan.currency, i18n.language);
  const yearly = plan.interval === 'year';

  const verify = async (thisRun: Run) => {
    setPhase('verifying');
    callbacks.current.onLockChange(true);

    for (let i = 0; i < VERIFY_ATTEMPTS; i++) {
      try {
        const status = (await billingService.sync()).data;
        if (!thisRun.alive) return;
        if (isPaid(status)) {
          callbacks.current.onLockChange(false);
          callbacks.current.onActivated(status);
          return;
        }
      } catch {
        // The charge already happened; a failed check is only a reason to ask again.
      }
      await sleep(i < 3 ? 1500 : 3000);
      if (!thisRun.alive) return;
    }

    callbacks.current.onLockChange(false);
    setPhase('slow');
  };

  useEffect(() => {
    const thisRun: Run = { alive: true };
    currentRun.current = thisRun;

    (async () => {
      let checkout;
      try {
        checkout = (
          await billingService.startCheckout({
            plan: plan.code,
            locale: language,
            acceptedTermsVersion: POLICY_VERSIONS.terms,
          })
        ).data;
      } catch (err) {
        if (!thisRun.alive) return;

        // Paid a moment ago in another tab or device: there is nothing to buy.
        if (extractApiErrorCode(err) === 'ALREADY_SUBSCRIBED') {
          try {
            const status = (await billingService.getStatus()).data;
            if (thisRun.alive && status.hasAccess) {
              callbacks.current.onActivated(status);
              return;
            }
          } catch {
            /* fall through to the message */
          }
        }
        if (!thisRun.alive) return;
        setStartError(
          extractApiError(err, t('billing.start_error', 'Could not start the payment. Check your connection and try again.')),
        );
        setPhase('start-error');
        return;
      }
      if (!thisRun.alive) return;
      setTestMode(checkout.mode === 'test');

      try {
        const sdk = await loadOnvoSdk();
        if (!thisRun.alive) return;

        const container = document.getElementById(FORM_ID);
        if (container) container.innerHTML = '';

        sdk
          .pay({
            publicKey: checkout.publishableKey,
            subscriptionId: checkout.subscriptionId,
            customerId: checkout.customerId,
            paymentType: 'subscription',
            locale: language === 'es' ? 'es' : 'en',
            onSuccess: () => {
              if (!thisRun.alive) return;
              setCardError(null);
              void verify(thisRun);
            },
            onError: (data: OnvoSdkError) => {
              if (!thisRun.alive) return;
              // ONVO's own text is informational and not localized: map the
              // stable reason to our copy instead of echoing it.
              const reason = data?.details?.card?.reason;
              setCardError(
                reason === 'issuer_declined'
                  ? t('billing.card_issuer_declined', 'Your bank declined the payment. Try another card or contact your bank.')
                  : reason === 'gateway_declined'
                    ? t('billing.card_gateway_declined', 'This card could not be accepted. Please try a different card.')
                    : t('billing.card_error', 'The payment did not go through. Check your card details or try another card.'),
              );
            },
          })
          .render(`#${FORM_ID}`);
        setPhase('form');
      } catch {
        if (thisRun.alive) setPhase('sdk-error');
      }
    })();

    return () => {
      thisRun.alive = false;
    };
    // verify/t are stable enough for a run; re-running on them would restart a payment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.code, language, attempt]);

  const retry = () => {
    setStartError(null);
    setCardError(null);
    setPhase('starting');
    setAttempt((a) => a + 1);
  };

  const busy = phase === 'starting' || phase === 'verifying';

  return (
    <div className="space-y-4">
      {testMode && <TestModeNotice withCard />}

      {/* Order summary */}
      <div className="rounded-card bg-inset px-4 py-3.5 flex items-center gap-3">
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-bold text-ink">
            {yearly
              ? t('billing.summary_yearly', 'ArtiCalorias, yearly plan')
              : t('billing.summary_monthly', 'ArtiCalorias, monthly plan')}
          </span>
          <span className="block text-[12px] text-ink-2 mt-0.5">
            {t('billing.summary_renews', 'Renews automatically. Cancel anytime.')}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[17px] font-extrabold text-ink tabular-nums leading-tight">{priceLabel}</span>
          <span className="block text-[11px] text-ink-2">
            {yearly ? t('billing.per_year', 'per year') : t('billing.per_month', 'per month')}
          </span>
        </span>
      </div>

      {/* The terms of the charge, before any card field. */}
      <p className="text-[13px] text-ink-2 leading-relaxed">
        {yearly
          ? t(
              'billing.disclosure_yearly',
              'You pay {{price}} today, then {{price}} every year until you cancel. Cancel anytime in Profile, Subscription: you keep access until the end of the year you paid for.',
              { price: priceLabel },
            )
          : t(
              'billing.disclosure_monthly',
              'You pay {{price}} today, then {{price}} every month until you cancel. Cancel anytime in Profile, Subscription: you keep access until the end of the month you paid for.',
              { price: priceLabel },
            )}{' '}
        {t('billing.disclosure_currency', 'Prices are in US dollars. Your bank may add its own fees.')}
      </p>

      {busy && (
        <div className="flex flex-col items-center gap-3 py-8 text-ink-2" role="status">
          <Spinner size={26} />
          <p className="text-sm font-medium text-center">
            {phase === 'starting'
              ? t('billing.preparing', 'Preparing secure payment')
              : t('billing.verifying', 'Confirming your payment. Please keep this open.')}
          </p>
        </div>
      )}

      {phase === 'form' && cardError && <InlineError message={cardError} />}

      {/* ONVO renders its card form in here. Kept mounted so the selector
          exists when render() runs; its own surface keeps a third-party form
          legible in dark mode. */}
      <div
        id={FORM_ID}
        className={phase === 'form' ? 'rounded-card bg-payment-surface p-2 min-h-56 overflow-hidden' : 'hidden'}
      />

      {phase === 'start-error' && (
        <div role="alert" className="rounded-card bg-danger-soft px-4 py-3.5">
          <p className="text-[14px] font-semibold text-danger">{startError}</p>
          <p className="mt-1 text-[13px] text-ink-2">{t('billing.not_charged', 'You were not charged.')}</p>
          <Button variant="secondary" size="md" icon="refresh" className="mt-3" onClick={retry}>
            {t('common.retry', 'Retry')}
          </Button>
        </div>
      )}

      {phase === 'sdk-error' && (
        <div role="alert" className="rounded-card bg-danger-soft px-4 py-3.5">
          <p className="text-[14px] font-semibold text-danger">
            {t('billing.sdk_error', 'The payment form could not load.')}
          </p>
          <p className="mt-1 text-[13px] text-ink-2">
            {t(
              'billing.sdk_error_hint',
              'Check your connection. If you use an ad or script blocker, allow sdk.onvopay.com and try again. You were not charged.',
            )}
          </p>
          <Button variant="secondary" size="md" icon="refresh" className="mt-3" onClick={retry}>
            {t('common.retry', 'Retry')}
          </Button>
        </div>
      )}

      {phase === 'slow' && (
        <div role="status" className="rounded-card bg-warning-soft px-4 py-3.5">
          <p className="text-[14px] font-semibold text-ink">
            {t('billing.slow_title', 'Your payment is still being confirmed')}
          </p>
          <p className="mt-1 text-[13px] text-ink-2 leading-relaxed">
            {t(
              'billing.slow_body',
              'This can take a minute. Do not pay again: you will not be charged twice, and your access turns on by itself as soon as the payment is confirmed.',
            )}
          </p>
          <Button variant="secondary" size="md" icon="refresh" className="mt-3" onClick={() => currentRun.current && void verify(currentRun.current)}>
            {t('billing.check_again', 'Check again')}
          </Button>
        </div>
      )}

      <p className="flex items-start gap-2 text-[12px] text-ink-3 leading-relaxed">
        <Icon name="lock" size={14} className="mt-0.5 shrink-0" />
        <span>
          {t(
            'billing.trust_note',
            'Payment is handled by ONVO Pay. ArtiCalorias never sees or stores your card details.',
          )}{' '}
          <button
            type="button"
            onClick={() => setShowTerms(true)}
            className="font-semibold text-primary-soft-ink underline underline-offset-2"
          >
            {t('billing.terms_link', 'By paying you accept the Terms of Use.')}
          </button>
        </span>
      </p>

      <PolicySheet doc={showTerms ? 'terms' : null} onClose={() => setShowTerms(false)} />
    </div>
  );
}
