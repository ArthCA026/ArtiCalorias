# Open questions for counsel (Ley 8968 / Decreto 37554-JP)

> Engineering has implemented the safest posture it could identify; these are
> the calls only a Costa Rican attorney can make. Numbered for reference.

**Q1 — Prodhab registration.** Does the ArtiCalorias user database require
registration with Prodhab under Art. 21 (databases "distributed, disseminated
or commercialized")? The database is internal to the service and never sold
or shared beyond the processors in `third-party-transfers.md`.

**Q2 — Consent as condition of service for sensitive data.** Health tracking
IS the service, so the app requires the express health-data consent to
register (consequence-of-refusal is disclosed per Art. 5). Is tying service
access to sensitive-data consent adequate under Art. 9's exception scheme,
or is an additional legal basis needed?

**Q3 — Minors policy.** Current gate: an 18+ self-declaration folded into the
terms checkbox, with the declaration clause inside the versioned terms
document (evidenced by the consent row). No birthdate is collected (data
minimization). Is self-declaration sufficient, or is a parental-consent flow
or stronger verification required?

**Q4 — Retention after revocation-without-deletion.** A user who withdraws
health-data consent but keeps the account is blocked from all new data writes
and signed out; stored data remains frozen until they delete it or re-consent.
The notice states this. Does frozen retention satisfy Art. 7 revocation, or
must revocation force erasure after some period?

**Q5 — Survival of the consent audit log.** `app.UserConsent` currently
cascade-deletes with the account, so deletion erases the evidence of consent
and of its revocation. May (or should) an anonymized consent log survive
account deletion for the controller's defense? If yes, engineering will
switch the delete path to anonymize instead of cascade.

**Q6 — Processor vs transfer classification.** Are Azure hosting, the SMTP
provider, and browser push vendors "transfers" requiring Art. 14 consent, or
processor relationships governed by contract? The notice currently discloses
all of them and the consent text covers the transfers reading.

**Q7 — Cross-border conditions to the USA.** Both hosting (Azure) and AI
processing (OpenAI) are in the United States. Beyond informed consent, does
Ley 8968 / the regulation impose additional conditions on transfers to
jurisdictions without an adequacy framework?

**Q8 — Backup purge window.** Deletion is immediate in the live database;
Azure SQL automated backups retain data for a bounded period the controller
does not directly control. The notice discloses a "limited additional time".
Is that disclosure sufficient?

**Q9 — Data-subject request SLA.** The notice offers in-app self-service for
all Art. 7 rights plus an email channel (r2chaves026@gmail.com). Confirm the
statutory response deadlines that apply to emailed requests and whether they
must be quoted in the notice.

## Subscription billing (added 2026-09-18)

ArtiCalorias became subscription-only (USD 9.99 monthly, USD 29.99 yearly,
charged through ONVO Pay with automatic renewal). The subscription clauses
in the Terms of Use are developer drafts. Nothing below has been reviewed.

**Q10 — Right of withdrawal (derecho de retracto).** Ley 7472 (Promoción de
la Competencia y Defensa Efectiva del Consumidor), Art. 40, and its
regulation grant a withdrawal period for sales made outside the merchant's
premises. Does it apply to a digital subscription bought online and used
immediately, and if so for how many days and from when? The draft terms say
"no refunds for partially used periods, except where the law grants a right
of withdrawal or a refund", which defers to the law without stating the
period. If the right applies, the terms and the checkout screen should state
it explicitly and the refund process must exist operationally (today a
refund is issued by hand from the ONVO dashboard; a FULL refund ends the
user's access at the next sync).

**Q11 — Automatic renewal disclosure and consent.** Before the card form,
the app shows: the price, that it renews automatically, the interval, that
it continues until cancelled, and how to cancel (Profile, Subscription, two
taps, effective at period end, reversible until then). The server also
refuses a checkout unless the account holds a recorded acceptance of the
CURRENT terms version, and stores that version with the checkout record.
Is that sufficient under Costa Rican consumer law, or is a separate express
checkbox for the recurring charge required? Is a renewal reminder (for
example before the yearly charge) mandatory? None is sent today.

**Q12 — Retention of billing records vs erasure.** Account deletion erases
`app.UserSubscription` and `app.BillingEvent`; ONVO keeps the transaction
records. Do tax or commercial rules (Código de Normas y Procedimientos
Tributarios, Código de Comercio) oblige the controller to keep its OWN
billing records for a number of years even after an erasure request? If
yes, engineering will switch these two tables from cascade-delete to
retain-and-minimize, and the notice must say so.

**Q13 — Taxes and invoicing.** Prices are charged exactly as displayed and
the terms say only that "the amount shown is the total amount we charge".
Is IVA due on these subscriptions (Costa Rican and foreign customers), must
the price be shown as IVA-inclusive, and is an electronic invoice (factura
electrónica) required per charge? No invoice is issued today. This one is
for an accountant as much as for counsel, and it gates going live.

**Q14 — Price changes.** The draft commits to 30 days' notice and applies a
new price only from a later renewal; existing subscribers technically keep
their original price until they are migrated. Confirm the notice period and
form (in-app, email, both) that consumer law requires.

**Q15 — Refund on discontinuation, and on account deletion.** The draft
promises a pro-rata refund if the service is discontinued, and states that
deleting the account forfeits the remaining paid time "except where the law
requires" a refund. Confirm both positions.

**Q16 — Complimentary accounts.** Some accounts are exempted from payment by
a server-side list. Any consumer-law or tax implication of free access
granted at the operator's discretion?

**Q17 — ONVO Pay as processor.** Confirm ONVO's role (processor vs
independent controller for the card data it collects in its own form),
where its platform is hosted, and whether the merchant agreement covers
Ley 8968 obligations. The notice currently lists it as a Costa Rican
payment processor receiving username, email and the card details typed
into its form.
