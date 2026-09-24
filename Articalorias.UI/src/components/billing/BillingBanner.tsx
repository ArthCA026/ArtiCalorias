import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui/Icon';
import { useBillingStatus } from '@/hooks/useBilling';
import { formatBillingDate } from '@/utils/billing';

/**
 * One line at the top of every tab while a renewal could not be charged. It
 * is the only billing message that follows the user around, because it is the
 * only one with a deadline: after the date shown the app locks. A cancelled
 * plan gets no banner (the user chose that; Profile shows the end date).
 */
export function BillingBanner() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data } = useBillingStatus();

  const sub = data?.subscription;
  // A whitelisted account is not going to be locked out: nothing to warn about.
  if (!data || !sub || sub.state !== 'past_due' || data.accessReason === 'whitelist') return null;
  // The subscription screen says the same thing in full.
  if (pathname.startsWith('/profile/subscription')) return null;

  return (
    <button
      type="button"
      onClick={() => navigate('/profile/subscription')}
      className="pressable w-full mb-4 rounded-card bg-warning-soft px-4 py-3 flex items-center gap-3 text-left"
    >
      <Icon name="alertTriangle" size={19} className="shrink-0 text-warning" />
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-bold text-ink">
          {t('billing.banner_title', 'Your payment did not go through')}
        </span>
        <span className="block text-[12px] text-ink-2 mt-0.5 leading-snug">
          {t('billing.banner_body', 'Update your payment by {{date}} to keep your access.', {
            date: formatBillingDate(sub.accessUntilUtc, i18n.language),
          })}
        </span>
      </span>
      <Icon name="chevronRight" size={18} className="shrink-0 text-ink-3" />
    </button>
  );
}
