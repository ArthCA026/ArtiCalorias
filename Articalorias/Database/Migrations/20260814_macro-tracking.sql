-- ============================================================
-- Migration: 20260814_macro-tracking
-- Description: Optional macro tracking (carbs, fat, alcohol, sugar,
--              water). Protein keeps its existing profile-based
--              pipeline and is untouched.
--
--   1. [app].[FoodEntry]   + [SugarGrams], [WaterMl]   (NULL-able)
--   2. [app].[FoodTemplate]+ [SugarGrams], [WaterMl]   (NULL-able)
--   3. [app].[DailyLog]    + [TotalSugarGrams], [TotalWaterMl],
--                            [MacroTargetsJson]
--   4. New table [app].[UserMacroPreference]
--
--   NULL semantics (deliberate, do not default to 0): a NULL value
--   means "not captured when this was logged" — that is what lets an
--   old day honestly say "water was not tracked on this day" instead
--   of showing a fake 0 once the user enables a new macro.
--
--   [MacroTargetsJson] freezes the tracked macros + targets that were
--   active on each day (same freeze rule as every other snapshot
--   column): enabling a macro today never rewrites yesterday.
--
-- Idempotent: guarded by sys.columns / sys.objects checks.
-- ============================================================

SET XACT_ABORT ON;
BEGIN TRANSACTION;

----------------------------------------------------------------
-- 1. FoodEntry
----------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[app].[FoodEntry]') AND name = N'SugarGrams')
BEGIN
    ALTER TABLE [app].[FoodEntry] ADD [SugarGrams] DECIMAL(10,2) NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[app].[FoodEntry]') AND name = N'WaterMl')
BEGIN
    ALTER TABLE [app].[FoodEntry] ADD [WaterMl] DECIMAL(10,2) NULL;
END

----------------------------------------------------------------
-- 2. FoodTemplate
----------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[app].[FoodTemplate]') AND name = N'SugarGrams')
BEGIN
    ALTER TABLE [app].[FoodTemplate] ADD [SugarGrams] DECIMAL(10,2) NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[app].[FoodTemplate]') AND name = N'WaterMl')
BEGIN
    ALTER TABLE [app].[FoodTemplate] ADD [WaterMl] DECIMAL(10,2) NULL;
END

----------------------------------------------------------------
-- 3. DailyLog
----------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[app].[DailyLog]') AND name = N'TotalSugarGrams')
BEGIN
    ALTER TABLE [app].[DailyLog] ADD [TotalSugarGrams] DECIMAL(10,2) NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[app].[DailyLog]') AND name = N'TotalWaterMl')
BEGIN
    ALTER TABLE [app].[DailyLog] ADD [TotalWaterMl] DECIMAL(10,2) NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[app].[DailyLog]') AND name = N'MacroTargetsJson')
BEGIN
    ALTER TABLE [app].[DailyLog] ADD [MacroTargetsJson] NVARCHAR(1000) NULL;
END

----------------------------------------------------------------
-- 4. UserMacroPreference
--    One row per user per optional macro ('carbs' | 'fat' | 'alcohol'
--    | 'sugar' | 'water'). A missing row = not tracked (the default).
----------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[app].[UserMacroPreference]')
      AND type = 'U'
)
BEGIN
    CREATE TABLE [app].[UserMacroPreference]
    (
        [UserMacroPreferenceId] BIGINT IDENTITY(1,1) NOT NULL,
        [UserId]                BIGINT        NOT NULL,
        [MacroKey]              NVARCHAR(20)  NOT NULL,
        [IsTracked]             BIT           NOT NULL CONSTRAINT [DF_UserMacroPreference_IsTracked] DEFAULT (0),
        [TargetMode]            NVARCHAR(10)  NOT NULL CONSTRAINT [DF_UserMacroPreference_TargetMode] DEFAULT (N'auto'),
        [CustomTargetValue]     DECIMAL(10,2) NULL,
        [CreatedAtUtc]          DATETIME2(0)  NOT NULL CONSTRAINT [DF_UserMacroPreference_CreatedAtUtc] DEFAULT SYSUTCDATETIME(),
        [UpdatedAtUtc]          DATETIME2(0)  NOT NULL CONSTRAINT [DF_UserMacroPreference_UpdatedAtUtc] DEFAULT SYSUTCDATETIME(),
        [RowVersion]            ROWVERSION    NOT NULL,

        CONSTRAINT [PK_UserMacroPreference] PRIMARY KEY ([UserMacroPreferenceId]),
        CONSTRAINT [FK_UserMacroPreference_User] FOREIGN KEY ([UserId])
            REFERENCES [app].[User] ([UserId]) ON DELETE CASCADE,
        CONSTRAINT [CK_UserMacroPreference_MacroKey]
            CHECK ([MacroKey] IN (N'carbs', N'fat', N'alcohol', N'sugar', N'water')),
        CONSTRAINT [CK_UserMacroPreference_TargetMode]
            CHECK ([TargetMode] IN (N'auto', N'custom'))
    );

    CREATE UNIQUE INDEX [UQ_UserMacroPreference_User_Macro]
        ON [app].[UserMacroPreference] ([UserId], [MacroKey]);
END

COMMIT TRANSACTION;
