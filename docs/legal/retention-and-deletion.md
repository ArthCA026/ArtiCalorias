# Retention and deletion — current behavior and gaps

> DRAFT FOR LEGAL REVIEW. As of 2026-09-09.

## What exists (verified in code)

- **Account deletion** (`DELETE /api/user/account` →
  `Services/UserService.cs` `DeleteAccountAsync`): a single transaction that
  hard-deletes push subscriptions, notification schedules, routines,
  templates, daily logs (cascading food/activity entries), monthly summaries,
  body measurements, macro preferences, the profile, and the user row.
  Refresh tokens, streaks, and consent rows cascade off the user row. This is
  genuine erasure, not a soft delete.
- **History clearing** (`DELETE /api/user/history`): wipes all logged days,
  summaries, and body measurements while keeping the account and settings.
- **Data export** (`GET /api/user/export`): one JSON document with every
  table the account holds, credentials excluded (Art. 7 access/portability).
- **Token hygiene**: expired/revoked refresh tokens are purged lazily on
  login; password-reset codes are nulled after use and expire in 15 minutes.
- **Consent audit**: append-only `app.UserConsent`, never edited, cascade-
  deleted with the account (pending Q5 in `open-questions-for-counsel.md`).

## Gaps (open items)

1. **No retention schedule.** Data lives until the user deletes it; there is
   no dormant-account purge and no maximum retention period. Awaiting
   counsel's guidance on whether one is required and at what horizon.
2. **Backup retention.** Azure SQL automated backups outlive a deletion for
   the provider's retention window. Not user-controllable; disclosed in the
   notice as a limited additional purge time (Q8).
3. **Server log retention.** Application logs no longer contain user content
   (redacted 2026-09-09, see `security-posture.md`), but the Azure App
   Service log retention window itself is deployment configuration and should
   be set deliberately.
4. **Stale legacy artifact**: the old stored procedure `admin.DeleteUser` in
   `Articalorias.UI/Database/DatabaseCreationScript.sql` references a table
   that no longer exists and misses newer tables. It must never be used; the
   API path is the only supported deletion. Consider dropping it from the DB.
