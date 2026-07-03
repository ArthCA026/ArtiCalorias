-- 2026-07-03 · Relax BMR check constraints to allow 0
-- BMRKcal = 0 is now a valid sentinel meaning "not yet calculated".
-- This happens when a user creates a profile without providing weight or height,
-- so the Mifflin–St Jeor auto-calc is skipped and both columns stay at 0.
-- Manual BMR values are still validated at the API layer (Range ≥ 1).

-- UserProfile.BMRKcal
ALTER TABLE app.UserProfile DROP CONSTRAINT CK_UserProfile_BMRKcal;

ALTER TABLE app.UserProfile
    ADD CONSTRAINT CK_UserProfile_BMRKcal CHECK (BMRKcal >= 0);

-- DailyLog.SnapshotBMRKcal
ALTER TABLE app.DailyLog DROP CONSTRAINT CK_DailyLog_SnapshotBMR;

ALTER TABLE app.DailyLog
    ADD CONSTRAINT CK_DailyLog_SnapshotBMR CHECK (SnapshotBMRKcal >= 0);
