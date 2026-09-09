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
