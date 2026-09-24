# Subscription billing with ONVO Pay: setup and operations

ArtiCalorias is subscription-only: USD 9.99 per month or USD 29.99 per year,
charged through ONVO Pay ("Cargos recurrentes"). This is the one page to read
before testing it, and again before going live.

Written 2026-09-18. Everything here was built against ONVO's published docs
and OpenAPI spec, and tested against a fake ONVO. **It has not yet run
against the real ONVO API**: see "Not yet verified against real ONVO" below and
treat the first test-mode purchase as the real integration test.

## 1. Where the keys go

Three values, all from the ONVO dashboard (Desarrolladores). They are secrets
store material: **never put them in `appsettings.json` or commit them.**

| Setting | ONVO value | Looks like |
|---|---|---|
| `Onvo:SecretKey` | Secret (private) API key | `onvo_test_secret_key_...` |
| `Onvo:PublishableKey` | Publishable (public) API key | `onvo_test_publishable_key_...` |
| `Onvo:WebhookSecret` | The secret shown next to your webhook | `webhook_secret_...` |

The publishable key also lives on the SERVER on purpose. The API hands it to
the browser with each checkout, so it can never drift out of sync with the
secret key. There is no ONVO key in the UI `.env` files.

**Local (user secrets).** From `ArtiCalorias/Articalorias`:

```powershell
& "C:\Program Files\dotnet\dotnet.exe" user-secrets set "Onvo:SecretKey" "onvo_test_secret_key_..."
& "C:\Program Files\dotnet\dotnet.exe" user-secrets set "Onvo:PublishableKey" "onvo_test_publishable_key_..."
& "C:\Program Files\dotnet\dotnet.exe" user-secrets set "Onvo:WebhookSecret" "webhook_secret_..."
```

**Azure (App Service > Environment variables).** Same names with a double
underscore: `Onvo__SecretKey`, `Onvo__PublishableKey`, `Onvo__WebhookSecret`,
plus `Billing__Enabled` (next section).

Both keys must be from the same mode. A test secret key with a live
publishable key (or the reverse) is detected: checkout reports "Payments are
temporarily unavailable" and the API logs the reason.

## 2. The paywall switch

`Billing:Enabled` decides whether anybody is asked to pay.

| Environment | Default | Why |
|---|---|---|
| Development (`appsettings.Development.json`) | `true` | So the whole flow is visible locally. |
| Everything else (`appsettings.json`) | `false` | Deploying this code must not lock out the people already using the app. |

While it is `false` the API is fully open, exactly as before, and the UI
hides every subscription screen. Turn it on in Azure with `Billing__Enabled =
true` only after the checklist in section 7.

## 3. First local test

1. **Apply the migration** `Articalorias/Database/Migrations/20260918_billing-subscriptions.sql`
   to your local database. Without it the billing endpoints, account deletion
   and data export fail (they query the new tables).
2. Set the three secrets (section 1). Test keys exist as soon as the ONVO
   account does; no business verification is needed for test mode.
3. Run the API and the UI as usual, sign in. Because the Terms and Privacy
   versions were bumped, you first pass the consent screen again.
4. You land on the paywall (unless your UserId is whitelisted, section 5).
   A yellow "Test mode" notice confirms the server is on test keys.
5. Pay with a test card. Any future expiry, any CVV, any name:

   | Scenario | Card |
   |---|---|
   | Approved (Visa) | `4242 4242 4242 4242` |
   | Approved (Mastercard) | `5555 5555 5555 4444` |
   | 3DS challenge | `4000 0000 0000 3220` |
   | Declined | `4000 0000 0000 0002` |
   | Processor error | `4000 0000 0000 0119` |

6. After "Confirming your payment" you are inside the app. Profile >
   Subscription shows the plan, the next charge date, and Cancel.
7. Cancel, confirm, then "Keep my subscription" to test resume.

## 4. The webhook

Register in the ONVO dashboard (Desarrolladores > Webhooks):

```
https://<your-api-host>/api/webhooks/onvo
```

Production: `https://articalorias-api-1-hkchgzdvhzcdgndz.westus2-01.azurewebsites.net/api/webhooks/onvo`

Copy the secret ONVO generates into `Onvo:WebhookSecret`. Until it is set the
endpoint answers 503 and processes nothing.

For local testing ONVO needs a public URL, so use a tunnel (`devtunnel`,
`ngrok`) pointed at port 5066. **The webhook is optional for a first test**:
the app asks the server to re-read the subscription right after paying, and
re-reads it again whenever a renewal date has passed and the user opens the
app. The webhook only makes renewals and failed payments show up sooner, and
it is what sends the "Payment failed" push notification.

How it is secured: ONVO authenticates deliveries with a static shared secret
in the `X-Webhook-Secret` header (there is no signature over the body). So the
body is never trusted. The only thing read from it is WHICH subscription to
look at; the state is then fetched from ONVO with the secret key. A forged or
replayed event can make the server re-read a subscription and nothing else.

## 5. The whitelist (free access)

`Articalorias/Configuration/SubscriptionWhitelist.cs`. Add UserIds, redeploy:

```csharp
private static readonly HashSet<long> UserIds =
[
    1,   // Arturo
    7,   // mom
];
```

Find ids with `SELECT UserId, Username, Email FROM [app].[User] ORDER BY UserId;`.
Ids are per database (local ids are not the Azure ids). It is code on purpose:
no endpoint, database row or config value can grant free access. A whitelisted
account sees "Complimentary access" under Profile > Subscription and cannot
start a checkout. Removing an id takes effect within about 5 minutes of the
deploy (the access check is cached that long).

**Before enabling billing in production, whitelist every existing account you
want to keep free.** Everyone else meets the paywall on their next visit.

## 6. How access is decided

Access follows what was verifiably PAID FOR, not ONVO's status alone. Each
sync reads the subscription from ONVO and, when its latest invoice is paid,
also reads the payment intent and checks it is settled, in USD, for at least
the price the plan was sold at, from the same customer. Only then is
`PaidThroughUtc` extended. This matters because ONVO lets the browser's
publishable key add items to an unconfirmed subscription, and because (like
Stripe) ONVO advances a subscription's period when a renewal is due even if
the charge failed.

| Situation | Access |
|---|---|
| Paid, renewing | Until the paid period ends, plus a 3-day grace |
| Renewal declined (`past_due`) | The 3-day grace, with a banner in the app; then the paywall |
| User cancelled | Until the paid period ends. No grace. Can resume until then |
| Full refund from the ONVO dashboard | Ends at the next sync (within 24 h, or when the webhook fires) |
| Partial refund | Unchanged (treated as goodwill) |
| Test-mode subscription while the server runs LIVE keys | None. Test purchases never unlock live |
| Whitelisted / `Billing:Enabled = false` | Always |

Without a subscription these still work: sign-in, consent, onboarding, the
billing screens, **data export and account deletion**. Everything else answers
`402 SUBSCRIPTION_REQUIRED`.

Deleting an account cancels its subscription at ONVO first. If ONVO cannot
confirm, the deletion is refused with a clear message, so an erased account
can never keep being charged.

## 7. Going live checklist

1. ONVO account verified for live mode; live keys in Azure; webhook registered
   with the LIVE secret.
2. Migration applied to the Azure database.
3. Existing accounts whitelisted as needed (section 5).
4. Legal: the subscription terms are a developer DRAFT. Questions Q10 to Q17
   in `docs/legal/open-questions-for-counsel.md` need a Costa Rican attorney,
   and **Q13 (IVA and electronic invoicing) an accountant**. No invoice is
   issued today.
5. One real purchase and one real cancellation with your own card.
6. Only then set `Billing__Enabled = true`.

Never run production on TEST keys with billing enabled: anyone could
"subscribe" with 4242 4242 4242 4242. The UI shows a test-mode notice in that
state precisely so it cannot go unnoticed.

## 8. Operating it

- **Refund someone:** ONVO dashboard. A full refund ends their access at the
  next sync. Also cancel the subscription there if it should not renew.
- **Change a price:** edit `Services/Billing/BillingPlans.cs`. New purchases get
  a new ONVO price automatically. Existing subscribers keep renewing at their
  old price; the terms promise 30 days' notice before that ever changes.
- **Audit trail:** `SELECT * FROM [app].[BillingEvent] WHERE UserId = @id ORDER BY CreatedAtUtc;`
  shows what they agreed to (plan, price, terms version), every verified
  payment, failures and cancellations.
- **Log lines worth alerting on** (all prefixed `Billing:`): `PAYMENT MISMATCH`,
  `ORPHANED ONVO subscription`, `holds two paid subscriptions`, `could not cancel`.

## 9. Known limits of this first version

- No plan switch or card update for an ACTIVE subscriber: they cancel and
  subscribe again when the period ends. A declined renewal does offer "Pay
  with another card" (a new subscription; the declined one is cancelled at
  ONVO as soon as the new payment is verified, so nobody is charged twice).
- No free trial. ONVO supports `trialPeriodDays` if you ever want one; it would
  need new disclosure copy and terms.
- No email receipts or renewal reminders from ArtiCalorias (SendGrid is out of
  credits anyway). Check whether ONVO emails receipts to the customer.
- Cards only, through ONVO's SDK form. SINPE Móvil is not wired for
  subscriptions.

## 10. Not yet verified against real ONVO

Built from the docs, so confirm each on the first test-mode runs:

1. Field names on real responses (`currentPeriodEnd`, `latestInvoice.status`,
   `latestInvoice.paymentIntentId`, `cancelAtPeriodEnd`). If access does not
   turn on after a successful test payment, this is the first place to look:
   the API log prints what ONVO answered.
2. That `POST /v1/subscriptions/{id}` with `cancelAtPeriodEnd: true` is honoured.
   If ONVO ignores it, the code detects that and cancels immediately instead
   (the paid time is still honoured locally, but "Keep my subscription" is
   then not offered).
3. How the SDK form looks inside the payment sheet on a phone, in dark mode,
   and during a 3DS challenge.
4. Which webhook events ONVO actually sends for the FIRST charge of a
   subscription.
5. ONVO's retry schedule for failed renewals, versus the 3-day grace.
