# Third-party recipients and international transfers (Art. 14)

> DRAFT FOR LEGAL REVIEW. As of 2026-09-18. All recipients below are disclosed
> in the privacy notice and covered by the health-data consent text.

| Recipient | Country | Data sent | Purpose | Trigger | Contract to confirm |
|---|---|---|---|---|---|
| OpenAI (API) | USA | Free-text meal/activity descriptions (≤2000 chars), meal photos (≤6 MB, jpeg/png/webp/gif), user's `Country` value injected into the system prompt, tracked-macros flags | AI parsing of logs into structured entries | User taps AI parse / photo parse | API data-usage terms; confirm the API no-training default and retention window; consider a DPA. No zero-retention flag or `user` abuse-tracking field is currently sent (`Services/FoodParsingService.cs`, `Services/ActivityParsingService.cs`). |
| Open Food Facts | France | Scanned barcode only; the outbound IP is the API server's, not the user's | Product lookup | Barcode scan | Public database ToS. No user identifier is transmitted. |
| Browser push services (Google FCM / Mozilla / Apple) | USA/EU | Push endpoint + encryption keys (stored in `dbo.PushSubscriptions`); payloads carry only reminder title/body, no health values. Since 2026-09-18 also one "Payment failed" notice per declined renewal (no amounts, no card data) | Meal reminders; failed-renewal notice | User enables reminders | Covered by browser-vendor terms; classify processor vs transfer (Q6). |
| SMTP email provider | Depends on deployment | Email address; the 6-digit reset code appears in the subject line (`Services/EmailService.cs`) | Password recovery | User requests reset | Identify the production provider and its DPA; move the code out of the subject line (see security-posture.md). |
| ONVO Pay (payment processor) | Costa Rica (confirm where ONVO hosts its platform) | Server to ONVO: username and email (customer record), internal UserId and plan as subscription metadata. Browser to ONVO directly: the card details the user types into ONVO's SDK form. ArtiCalorias never receives the card number, expiry or CVV | Charging the subscription (added 2026-09-18) | User starts a checkout; renewals are charged by ONVO on its own schedule | ONVO merchant agreement; confirm its data-processing terms, PCI DSS attestation, retention of transaction records, and whether it sub-processes outside Costa Rica. Code: `Services/Billing/OnvoClient.cs`, `Controllers/OnvoWebhookController.cs`, UI `src/lib/onvoSdk.ts` (script loaded from `sdk.onvopay.com` only when a checkout opens). |
| Microsoft Azure | USA (West US 2) | Everything at rest: API app, SQL database, static frontend | Hosting | Always | Microsoft DPA / Products and Services Data Protection Addendum; confirm coverage for CR-based controller. |

## Verified absent

No analytics, crash reporting, advertising, or social login exist in the
codebase (repo-wide dependency and SDK sweep, 2026-09-09). If any is ever
added, the notice must be updated and re-consent triggered by a version bump.

A payment processor (ONVO Pay) WAS added on 2026-09-18. That rule was
followed: the Privacy Notice and the Terms of Use went to version 2026-09-18,
which sends every existing account through the consent gate again.
