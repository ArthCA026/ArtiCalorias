-- ============================================================
-- Migration: 20260829_protein-goal-per-kg
-- Description: Auto protein goals that follow the body.
--
--   [app].[UserProfile] + [ProteinGoalGramsPerKg] DECIMAL(4,2) NULL
--
--   When AutoCalculateProteinGoal = 1, the effective goal is now
--   CurrentWeightKg x this multiplier (floored by an age minimum),
--   re-derived on every day snapshot. Picking a protein preset stores
--   the multiplier instead of a frozen gram figure, so a user who
--   skipped their weight during onboarding gets their chosen target
--   activated automatically the moment the weight arrives - and the
--   target keeps tracking the weight afterwards.
--
--   NULL = the historical 2.0 g/kg fallback, so existing auto-mode
--   profiles compute exactly the same goal as before. Profiles with a
--   custom gram figure (AutoCalculateProteinGoal = 0) are unaffected.
--
-- Idempotent: guarded by sys.columns check.
-- ============================================================

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[app].[UserProfile]') AND name = N'ProteinGoalGramsPerKg')
BEGIN
    ALTER TABLE [app].[UserProfile] ADD [ProteinGoalGramsPerKg] DECIMAL(4,2) NULL;
END

COMMIT TRANSACTION;
