export type BillingPlanCode = 'monthly' | 'yearly';

/** "test" = ONVO sandbox: the whole flow works and no real money moves. */
export type BillingMode = 'test' | 'live';

export type BillingAccessReason = 'subscription' | 'grace' | 'whitelist' | 'billing_disabled' | 'none';

/**
 * active:    paid and renewing on its own
 * past_due:  a renewal is overdue or was declined; access continues for a short grace window
 * canceling: the user cancelled; paid time remains, nothing renews, can be resumed
 * ended:     was paid once, grants nothing now
 */
export type SubscriptionState = 'active' | 'past_due' | 'canceling' | 'ended';

export interface BillingPlan {
  code: BillingPlanCode;
  /** Minor units (US cents). Always rendered through formatPrice. */
  priceCents: number;
  currency: string;
  interval: 'month' | 'year';
}

export interface BillingSubscription {
  plan: BillingPlanCode;
  priceCents: number;
  currency: string;
  state: SubscriptionState;
  /** UTC instant. End of the paid period: next charge while renewing, last day when canceling. */
  paidThroughUtc: string | null;
  /** UTC instant. When access actually stops (paid period plus any grace). */
  accessUntilUtc: string | null;
  startedAtUtc: string;
  cancelAtPeriodEnd: boolean;
  /** A cancellation that can still be undone without paying again. */
  canResume: boolean;
  /** The plan ended because the renewal could not be charged, not because the user left. */
  endedByPaymentFailure: boolean;
}

export interface BillingStatus {
  /** False: subscriptions are switched off on the server. Hide every billing screen. */
  billingEnabled: boolean;
  hasAccess: boolean;
  accessReason: BillingAccessReason;
  mode: BillingMode | null;
  /** False when payments cannot be taken right now. */
  checkoutAvailable: boolean;
  subscription: BillingSubscription | null;
  plans: BillingPlan[];
  /** Days with food logged. Only sent to accounts without access. */
  daysLogged: number | null;
}

export interface StartCheckoutRequest {
  plan: BillingPlanCode;
  locale: string;
  /** Version of the Terms of Use on screen when the user asked to pay. */
  acceptedTermsVersion: string;
}

/** What ONVO's browser SDK needs to render the card form for this purchase. */
export interface StartCheckoutResponse {
  subscriptionId: string;
  customerId: string;
  publishableKey: string;
  mode: BillingMode;
  plan: BillingPlanCode;
  priceCents: number;
  currency: string;
}
