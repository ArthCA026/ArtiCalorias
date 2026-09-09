import api from './api';
import type { ConsentState, PolicyVersionsResponse, RecordConsentRequest } from '@/types';

export const consentService = {
  /** Anonymous: the register page reads versions before an account exists. */
  getPolicies() {
    return api.get<PolicyVersionsResponse>('/consent/policies');
  },

  getState() {
    return api.get<ConsentState>('/consent');
  },

  record(data: RecordConsentRequest) {
    return api.post<ConsentState>('/consent', data);
  },
};
