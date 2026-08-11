-- ============================================================
-- Migration: 20260810_fasting-day
-- Description: Adds [app].[DailyLog].[IsFastingDay] — an explicit
--              "this day was a deliberate fast" marker.
--
--              Distinguishes a real fasted day (banks its genuine
--              deficit into the weekly-adjusted budget, keeps the
--              logging streak alive, counts in Progress and the
--              weight estimate) from a merely unlogged day (which
--              is assumed on-plan and banks nothing).
--
--              Default 0 for all existing rows: no historical day
--              is retroactively marked; users can mark past days
--              from the day view themselves.
-- Idempotent: guarded by sys.columns check.
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[app].[DailyLog]')
      AND name = N'IsFastingDay'
)
BEGIN
    ALTER TABLE [app].[DailyLog]
        ADD [IsFastingDay] BIT NOT NULL
            CONSTRAINT [DF_DailyLog_IsFastingDay] DEFAULT (0);
END
