import api from './api';
import type { BillingStatus, StartCheckoutRequest, StartCheckoutResponse } from '@/types';

export const billingService = {
  /** Access, current subscription and the plan catalogue, in one call. */
  getStatus() {
    return api.get<BillingStatus>('/billing/status');
  },

  /** Prepares a purchase for ONVO's card form. Nothing is charged here. */
  startCheckout(data: StartCheckoutRequest) {
    return api.post<StartCheckoutResponse>('/billing/checkout', data);
  },

  /** Asks the server to re-read the subscription from ONVO (after paying, "refresh status"). */
  sync() {
    return api.post<BillingStatus>('/billing/sync');
  },

  /** Stops the renewal. Access continues to the end of the paid period. */
  cancel() {
    return api.post<BillingStatus>('/billing/cancel');
  },

  /** Undoes a cancellation that has not taken effect yet. */
  resume() {
    return api.post<BillingStatus>('/billing/resume');
  },
};
