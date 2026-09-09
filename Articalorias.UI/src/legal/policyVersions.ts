/**
 * Current versions of the legal documents, as ISO-date strings.
 * Must match Articalorias/Configuration/PolicyVersions.cs. Bump both in the
 * same commit that changes the policy text: the server rejects grants at any
 * other version, so a stale build fails safe instead of recording consent to
 * text the user never saw.
 */
export const POLICY_VERSIONS = {
  terms: '2026-09-09',
  privacy: '2026-09-09',
  health_data: '2026-09-09',
} as const;

export type ConsentType = keyof typeof POLICY_VERSIONS;

export const CONSENT_TYPES = Object.keys(POLICY_VERSIONS) as ConsentType[];
