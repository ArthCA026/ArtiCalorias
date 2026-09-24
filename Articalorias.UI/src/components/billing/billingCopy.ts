import type { TFunction } from 'i18next';
import type { BillingStatus } from '@/types';

/**
 * Body of the "delete your account" confirmation. Deleting the account also
 * cancels the subscription on the spot, and the time already paid for is
 * lost: someone about to do that must read it BEFORE confirming, not discover
 * it afterwards.
 */
export function deleteAccountBody(t: TFunction, status: BillingStatus | undefined): string {
  const base = t(
    'profile.delete_account_body',
    'Your account and all your data are permanently deleted. There is no way back. If you only want a fresh start, clear your history instead.',
  );

  const subscription = status?.subscription;
  if (!subscription || subscription.state === 'ended') return base;

  return `${base} ${t(
    'billing.delete_account_warning',
    'Your subscription is cancelled immediately, the time left on it is lost, and it is not refunded.',
  )}`;
}
