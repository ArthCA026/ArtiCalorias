# ArtiCalorias legal dossier (Ley 8968)

**Status: DRAFT FOR LEGAL REVIEW.** Everything in this folder, and the legal
text shipped inside the app, is a developer-authored draft pending validation
by a legal professional in Costa Rica. The in-app documents display a visible
draft banner until that review is complete.

Prepared 2026-09-09. Data controller in the drafts: **Arthuro Chaves Aguilar**,
contact **r2chaves026@gmail.com**, physical address pending (`[ADDRESS]`
placeholder in both documents).

## Contents

| File | Purpose |
|---|---|
| `policies/privacy-notice.es.md` / `.en.md` | Canonical redline copies of the in-app Privacy Notice |
| `policies/terms.es.md` / `.en.md` | Canonical redline copies of the in-app Terms of Use |
| `data-inventory.md` | Every personal/health data point stored, table by table |
| `third-party-transfers.md` | Art. 14 matrix: who receives what, and the contracts to confirm |
| `open-questions-for-counsel.md` | The legal questions engineering cannot answer |
| `retention-and-deletion.md` | Current retention/deletion behavior and its gaps |
| `security-posture.md` | Security measures in place and tracked open items (Art. 10) |

## How consent works in the app (for the reviewer)

- Consent is recorded in an append-only SQL table `app.UserConsent`: one row
  per grant or revocation, with consent type (`terms`, `privacy`,
  `health_data`), document version, language shown, source, and UTC timestamp.
  Rows are never edited. Current state is the newest row per type.
- Health-data consent is a **separate express checkbox** at registration,
  distinct from the terms/privacy acceptance (Art. 9 posture for sensitive
  data). The server rejects registrations missing either consent; checkboxes
  alone are not the enforcement.
- Existing accounts (created before this system) are blocked at a consent
  gate at next sign-in until they actively accept. **No consent was ever
  backfilled.**
- Revocation lives in Profile > Legal. Withdraw-and-delete erases the account;
  withdraw-only records the revocation, signs the user out, and the backend
  rejects any new data writes until re-consent. Reads and deletion remain
  available to revoked users (Art. 7 access and deletion rights).
- Users can download all their data as one JSON file (Profile > Legal >
  Download my data) and see their full consent history in the app.

## Document versioning

Versions are ISO dates (`2026-09-09`), defined in two constants files that
must always match and are bumped together with any text change:

- Backend: `Articalorias/Configuration/PolicyVersions.cs` (authoritative;
  rejects consent recorded against any other version)
- Frontend: `Articalorias.UI/src/legal/policyVersions.ts`

Bumping a version automatically re-gates every user at next app open: that is
the designed mechanism for rolling out attorney-approved wording.

## Editing workflow for counsel

1. Redline the markdown files in `policies/`.
2. Developer transcribes the approved text into the app content modules
   (`Articalorias.UI/src/legal/content/*.ts`), fills in the controller
   address, bumps both version constants, and removes the draft banners.
3. Every user is asked to accept the approved version on next use.

## Subscription billing (added 2026-09-18)

- The app is subscription-only. Terms and Privacy Notice are at version
  **2026-09-18** (health-data consent text unchanged, still 2026-09-09). The
  bump re-runs the consent gate for every existing account.
- Payments run through ONVO Pay. Card data goes from the browser to ONVO's
  form and never reaches ArtiCalorias. See `third-party-transfers.md`.
- Accounts without a subscription keep the Art. 7 rights without paying:
  data export and account deletion stay open on the paywall itself, and the
  API leaves `api/user/*` outside the paywall
  (`Middleware/SubscriptionEnforcementMiddleware.cs`).
- A user who declines a new policy version can still cancel their
  subscription from the consent gate (`api/billing` is exempt from the
  consent middleware), so nobody pays for an app they are locked out of.
- Unreviewed legal questions specific to billing: Q10 to Q17 in
  `open-questions-for-counsel.md`. Q13 (IVA, invoicing) gates going live.
