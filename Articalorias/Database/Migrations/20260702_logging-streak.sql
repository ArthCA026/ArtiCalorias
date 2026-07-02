-- ============================================================
-- Migration: 20260702_logging-streak
-- Description: Creates [app].[UserStreaks] table to persist
--              per-user logging streak state (enabled flag,
--              current streak, lifetime longest streak, last
--              qualifying date).
--              Also adds nullable TimeZoneId column to
--              [app].[UserProfile] for timezone-aware streak
--              date resolution.
-- Idempotent: all DDL guarded by sys.objects / sys.indexes /
--             COL_LENGTH checks.
-- ============================================================

-- 1. UserStreaks table
IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[app].[UserStreaks]')
      AND type = 'U'
)
BEGIN
    CREATE TABLE [app].[UserStreaks]
    (
        [UserStreakId]   BIGINT          NOT NULL IDENTITY(1,1),
        [UserId]         BIGINT          NOT NULL,
        [StreakEnabled]  BIT             NOT NULL CONSTRAINT [DF_UserStreaks_StreakEnabled]  DEFAULT (1),
        [CurrentStreak]  INT             NOT NULL CONSTRAINT [DF_UserStreaks_CurrentStreak]  DEFAULT (0),
        [LongestStreak]  INT             NOT NULL CONSTRAINT [DF_UserStreaks_LongestStreak]  DEFAULT (0),
        [LastLoggedDate] DATE            NULL,
        [CreatedAtUtc]   DATETIME2(0)    NOT NULL CONSTRAINT [DF_UserStreaks_CreatedAtUtc]   DEFAULT SYSUTCDATETIME(),
        [UpdatedAtUtc]   DATETIME2(0)    NOT NULL CONSTRAINT [DF_UserStreaks_UpdatedAtUtc]   DEFAULT SYSUTCDATETIME(),
        [RowVersion]     ROWVERSION      NOT NULL,

        CONSTRAINT [PK_UserStreaks]
            PRIMARY KEY ([UserStreakId]),
        CONSTRAINT [FK_UserStreaks_User]
            FOREIGN KEY ([UserId]) REFERENCES [app].[User] ([UserId])
            ON DELETE CASCADE,
        CONSTRAINT [CK_UserStreaks_CurrentStreak]
            CHECK ([CurrentStreak] >= 0),
        CONSTRAINT [CK_UserStreaks_LongestStreak]
            CHECK ([LongestStreak] >= 0)
    );
END;

-- Unique index: one row per user
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[app].[UserStreaks]')
      AND name = N'IX_UserStreaks_UserId'
)
BEGIN
    CREATE UNIQUE INDEX [IX_UserStreaks_UserId]
        ON [app].[UserStreaks] ([UserId]);
END;

-- 2. TimeZoneId column on UserProfiles
IF COL_LENGTH('[app].[UserProfile]', 'TimeZoneId') IS NULL
BEGIN
    ALTER TABLE [app].[UserProfile]
        ADD [TimeZoneId] NVARCHAR(50) NULL;
END;
