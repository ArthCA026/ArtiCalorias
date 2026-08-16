-- ============================================================
-- Migration: 20260814_activity-tracking-and-flags
-- Description:
--   1. [app].[User].[LastActiveAtUtc] — last time the user actively
--      opened the app (heartbeat from a visible session). Template
--      auto-add pauses when this is older than 3 days, so abandoned
--      accounts / forgotten open tabs stop fabricating daily meals
--      and calculations ("zombie days"). NULL = treated as active
--      (new accounts must get their very first auto-add).
--
--   2. [app].[UserProfile].[FirstFoodLoggedAtUtc] — first time the
--      user logged food THEMSELF (manual, AI, barcode, template,
--      routine; template auto-add does not count). Gates the
--      "You are N of 3 steps in" checklist so it only ever shows to
--      people who have never logged anything.
--      Backfilled from the earliest existing food entry.
--
--   3. [app].[UserProfile].[HasSeenTutorial] — first-run interactive
--      tutorial completed or skipped. Backfilled to 1 for every
--      already-onboarded profile: the tutorial is for new users only.
--
-- Idempotent: column adds guarded by sys.columns; one-shot backfills
--             guarded by [app].[DataMigration] marker rows.
-- ============================================================

SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- 0. Marker table for one-shot data migrations (created by the 20260809
--    migration on existing databases; guarded here for fresh ones).
IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[app].[DataMigration]')
      AND type = 'U'
)
BEGIN
    CREATE TABLE [app].[DataMigration]
    (
        [Name]         NVARCHAR(100) NOT NULL,
        [AppliedAtUtc] DATETIME2(0)  NOT NULL CONSTRAINT [DF_DataMigration_AppliedAtUtc] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_DataMigration] PRIMARY KEY ([Name])
    );
END

----------------------------------------------------------------
-- 1. User.LastActiveAtUtc
----------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[app].[User]')
      AND name = N'LastActiveAtUtc'
)
BEGIN
    ALTER TABLE [app].[User]
        ADD [LastActiveAtUtc] DATETIME2(0) NULL;
END

----------------------------------------------------------------
-- 2. UserProfile.FirstFoodLoggedAtUtc (+ backfill)
----------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[app].[UserProfile]')
      AND name = N'FirstFoodLoggedAtUtc'
)
BEGIN
    ALTER TABLE [app].[UserProfile]
        ADD [FirstFoodLoggedAtUtc] DATETIME2(0) NULL;
END

----------------------------------------------------------------
-- 3. UserProfile.HasSeenTutorial (+ backfill)
----------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[app].[UserProfile]')
      AND name = N'HasSeenTutorial'
)
BEGIN
    ALTER TABLE [app].[UserProfile]
        ADD [HasSeenTutorial] BIT NOT NULL
            CONSTRAINT [DF_UserProfile_HasSeenTutorial] DEFAULT (0);
END

----------------------------------------------------------------
-- 4. One-shot backfills (dynamic SQL: the columns above are new in
--    this batch, so direct references would not compile).
----------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM [app].[DataMigration]
    WHERE [Name] = N'20260814_activity-tracking-and-flags'
)
BEGIN
    -- 4a. FirstFoodLoggedAtUtc = the user's earliest food entry timestamp.
    --     Users who genuinely never logged stay NULL and keep the checklist.
    EXEC sp_executesql N'
        UPDATE up
        SET up.[FirstFoodLoggedAtUtc] = ff.[FirstUtc]
        FROM [app].[UserProfile] up
        INNER JOIN
        (
            SELECT dl.[UserId], MIN(fe.[CreatedAtUtc]) AS [FirstUtc]
            FROM [app].[FoodEntry] fe
            INNER JOIN [app].[DailyLog] dl ON dl.[DailyLogId] = fe.[DailyLogId]
            GROUP BY dl.[UserId]
        ) ff ON ff.[UserId] = up.[UserId]
        WHERE up.[FirstFoodLoggedAtUtc] IS NULL;';

    -- 4b. Existing (already onboarded) users never see the new tutorial.
    EXEC sp_executesql N'
        UPDATE [app].[UserProfile]
        SET [HasSeenTutorial] = 1
        WHERE [IsOnboardingCompleted] = 1;';

    INSERT INTO [app].[DataMigration] ([Name])
    VALUES (N'20260814_activity-tracking-and-flags');
END

COMMIT TRANSACTION;
