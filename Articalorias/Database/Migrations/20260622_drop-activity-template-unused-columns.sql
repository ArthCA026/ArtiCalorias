-- ============================================================
-- Migration: 20260622_drop-activity-template-unused-columns
-- Description: Remove Notes, Segments, and ActivityType columns
--              from app.ActivityTemplate (never used in code).
-- Idempotent: each DROP is guarded by IF COL_LENGTH.
-- ============================================================

IF COL_LENGTH('app.ActivityTemplate', 'Notes') IS NOT NULL
    ALTER TABLE [app].[ActivityTemplate] DROP COLUMN [Notes];

IF COL_LENGTH('app.ActivityTemplate', 'Segments') IS NOT NULL
    ALTER TABLE [app].[ActivityTemplate] DROP COLUMN [Segments];

IF COL_LENGTH('app.ActivityTemplate', 'ActivityType') IS NOT NULL
    ALTER TABLE [app].[ActivityTemplate] DROP COLUMN [ActivityType];
