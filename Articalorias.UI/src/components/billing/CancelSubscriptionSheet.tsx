import { useTranslation } from 'react-i18next';
import { ConfirmSheet } from '@/components/ui/ActionSheet';
import { useToast } from '@/components/ui/Toast';
import { useBillingStatus, useCancelSubscription } from '@/hooks/useBilling';
import { extractApiError } from '@/utils/apiError';
import { formatBillingDate } from '@/utils/billing';

interface CancelSubscriptionSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The one confirmation between "Cancel subscription" and a cancelled
 * subscription. It states what happens next (no more charges, access until
 * the paid date, data kept) and nothing else: no counter-offer, no survey, no
 * second screen. Shared by Profile > Subscription and the consent gate, so a
 * user who declines new terms can still stop paying.
 */
export function CancelSubscriptionSheet({ open, onClose }: CancelSubscriptionSheetProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { data } = useBillingStatus();
  const cancel = useCancelSubscription();

  const sub = data?.subscription;
  const date = (iso: string | null | undefined) => formatBillingDate(iso, i18n.language);

  const onConfirm = () =>
    cancel.mutate(undefined, {
      onSuccess: (next) => {
        onClose();
        const until = next.subscription?.state === 'canceling' ? next.subscription.accessUntilUtc : null;
        toast(
          'info',
          until
            ? t('billing.cancelled_toast_until', 'Subscription cancelled. You keep access until {{date}}.', { date: date(until) })
            : t('billing.cancelled_toast', 'Subscription cancelled. You will not be charged again.'),
        );
      },
      onError: (err) => {
        onClose();
        toast(
          'error',
          extractApiError(err, t('billing.cancel_error', 'Could not cancel right now. Nothing was changed. Please try again in a moment.')),
        );
      },
    });

  return (
    <ConfirmSheet
      open={open}
      onClose={onClose}
      title={t('billing.cancel_title', 'Cancel your subscription?')}
      body={
        sub?.state === 'past_due'
          ? t(
              'billing.cancel_body_past_due',
              'We stop trying to charge your card right away. The current period was never paid, so your access ends now. Everything you logged stays saved and you can subscribe again anytime.',
            )
          : t(
              'billing.cancel_body',
              'You will not be charged again, and you keep full access until {{date}}. After that the app locks. Everything you logged stays saved, and you can change your mind any time before then.',
              // The paid period, not accessUntil: the renewal grace no longer applies once cancelled.
              { date: date(sub?.paidThroughUtc) },
            )
      }
      confirmLabel={t('billing.cancel_confirm', 'Cancel subscription')}
      cancelLabel={t('billing.cancel_keep', 'Keep my subscription')}
      loading={cancel.isPending}
      onConfirm={onConfirm}
    />
  );
}
