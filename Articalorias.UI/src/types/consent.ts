export type ConsentTypeName = 'terms' | 'privacy' | 'health_data';
export type ConsentAction = 'granted' | 'revoked';

export interface PolicyVersionInfo {
  consentType: ConsentTypeName;
  currentVersion: string;
}

export interface PolicyVersionsResponse {
  policies: PolicyVersionInfo[];
}

export interface ConsentStateItem {
  consentType: ConsentTypeName;
  /** "granted" | "revoked" | "none" (never recorded). */
  status: 'granted' | 'revoked' | 'none';
  policyVersion: string | null;
  recordedAtUtc: string | null;
  /** True when granted at the currently required version. */
  isCurrent: boolean;
}

export interface ConsentHistoryItem {
  consentType: ConsentTypeName;
  policyVersion: string;
  action: ConsentAction;
  locale: string;
  source: string;
  createdAtUtc: string;
}

export interface ConsentState {
  consents: ConsentStateItem[];
  /** Types missing, revoked, or stale. The gate blocks while non-empty. */
  requiresConsent: ConsentTypeName[];
  /** Full audit trail, newest first. */
  history: ConsentHistoryItem[];
}

export interface ConsentDecision {
  consentType: ConsentTypeName;
  policyVersion: string;
  action: ConsentAction;
}

export interface RecordConsentRequest {
  consents: ConsentDecision[];
  locale: string;
  source: 'reconsent' | 'profile';
}
