-- ============================================================
-- Migration: 20260829_goal-target-by-date
-- Description: "Reach X by DATE" goals. The goal planner can now be
--              set as a destination (a target weight OR a target
--              body-fat %, plus a date) instead of a weekly pace.
--              The calorie pipeline still runs exclusively off
--              [DailyBaseGoalKcal]; these columns are the motivational
--              metadata behind it (shown in Profile > Goal and used to
--              re-derive the pace when the user edits the target).
--
--   [app].[UserProfile] + [GoalTargetWeightKg]       DECIMAL(8,2) NULL
--                       + [GoalTargetBodyFatPercent] DECIMAL(5,2) NULL
--                       + [GoalTargetDate]           DATE         NULL
--
--   All NULL = the user chose a plain weekly pace (the previous and
--   default behavior). At most one of weight / body-fat is set, always
--   together with the date (enforced by the API on every save).
--
-- Idempotent: guarded by sys.columns checks.
-- ============================================================

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[app].[UserProfile]') AND name = N'GoalTargetWeightKg')
BEGIN
    ALTER TABLE [app].[UserProfile] ADD [GoalTargetWeightKg] DECIMAL(8,2) NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[app].[UserProfile]') AND name = N'GoalTargetBodyFatPercent')
BEGIN
    ALTER TABLE [app].[UserProfile] ADD [GoalTargetBodyFatPercent] DECIMAL(5,2) NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[app].[UserProfile]') AND name = N'GoalTargetDate')
BEGIN
    ALTER TABLE [app].[UserProfile] ADD [GoalTargetDate] DATE NULL;
END

COMMIT TRANSACTION;
