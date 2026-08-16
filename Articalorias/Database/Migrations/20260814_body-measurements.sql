-- ============================================================
-- Migration: 20260814_body-measurements
-- Description: Dated weight / body-fat measurements behind the new
--              Body page (weight and body-fat graphs over time).
--
--   1. New table [app].[BodyMeasurement] — one row per user per
--      LOCAL calendar day (unique index). Saving twice on one day
--      updates the row, keeping the graph one-point-per-day.
--
--   2. Backfill (one-shot, marker-guarded): reconstructs the weight
--      history every user already has inside their DailyLog
--      snapshots. A measurement is created for the first logged day
--      and for every day the snapshot weight CHANGED vs the previous
--      day — i.e. exactly the days the user updated their weight.
--      Source = 'history' so the UI can tell backfilled points from
--      hand-entered ones. Body fat is carried along only when the
--      profile stores a manually-entered value today; historical
--      auto-estimates are recomputable and are not stored as data.
--
-- Idempotent: table guarded by sys.objects, backfill by the
--             [app].[DataMigration] marker.
-- ============================================================

SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- 0. Marker table (created by earlier migrations; guarded for fresh DBs).
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
-- 1. BodyMeasurement table
----------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[app].[BodyMeasurement]')
      AND type = 'U'
)
BEGIN
    CREATE TABLE [app].[BodyMeasurement]
    (
        [BodyMeasurementId] BIGINT IDENTITY(1,1) NOT NULL,
        [UserId]            BIGINT       NOT NULL,
        [MeasuredOn]        DATE         NOT NULL,
        [WeightKg]          DECIMAL(8,2) NULL,
        [BodyFatPercent]    DECIMAL(5,2) NULL,
        [Source]            NVARCHAR(20) NOT NULL CONSTRAINT [DF_BodyMeasurement_Source] DEFAULT (N'manual'),
        [CreatedAtUtc]      DATETIME2(0) NOT NULL CONSTRAINT [DF_BodyMeasurement_CreatedAtUtc] DEFAULT SYSUTCDATETIME(),
        [UpdatedAtUtc]      DATETIME2(0) NOT NULL CONSTRAINT [DF_BodyMeasurement_UpdatedAtUtc] DEFAULT SYSUTCDATETIME(),
        [RowVersion]        ROWVERSION   NOT NULL,

        CONSTRAINT [PK_BodyMeasurement] PRIMARY KEY ([BodyMeasurementId]),
        CONSTRAINT [FK_BodyMeasurement_User] FOREIGN KEY ([UserId])
            REFERENCES [app].[User] ([UserId]) ON DELETE CASCADE,
        CONSTRAINT [CK_BodyMeasurement_HasValue]
            CHECK ([WeightKg] IS NOT NULL OR [BodyFatPercent] IS NOT NULL)
    );

    CREATE UNIQUE INDEX [UQ_BodyMeasurement_User_Date]
        ON [app].[BodyMeasurement] ([UserId], [MeasuredOn]);
END

----------------------------------------------------------------
-- 2. One-shot backfill from DailyLog snapshots
----------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM [app].[DataMigration]
    WHERE [Name] = N'20260814_body-measurements'
)
BEGIN
    -- Weight-change points from day snapshots. LAG finds the previous
    -- logged day's weight; the first logged day and every change become
    -- measurements. Days without a snapshot weight say nothing.
    INSERT INTO [app].[BodyMeasurement] ([UserId], [MeasuredOn], [WeightKg], [BodyFatPercent], [Source])
    SELECT s.[UserId], s.[LogDate], s.[SnapshotWeightKg],
           -- Only carry a body fat that was a real user value: profiles in
           -- auto mode store formula estimates, which stay derivable.
           CASE WHEN up.[AutoCalculateBodyFat] = 0 THEN s.[SnapshotBodyFatPercent] END,
           N'history'
    FROM
    (
        SELECT dl.[UserId], dl.[LogDate], dl.[SnapshotWeightKg],
               dl.[SnapshotBodyFatPercent],
               LAG(dl.[SnapshotWeightKg]) OVER (PARTITION BY dl.[UserId] ORDER BY dl.[LogDate]) AS [PrevWeightKg]
        FROM [app].[DailyLog] dl
        WHERE dl.[SnapshotWeightKg] IS NOT NULL
    ) s
    INNER JOIN [app].[UserProfile] up ON up.[UserId] = s.[UserId]
    WHERE (s.[PrevWeightKg] IS NULL OR s.[PrevWeightKg] <> s.[SnapshotWeightKg])
      AND NOT EXISTS (
          SELECT 1 FROM [app].[BodyMeasurement] bm
          WHERE bm.[UserId] = s.[UserId] AND bm.[MeasuredOn] = s.[LogDate]
      );

    INSERT INTO [app].[DataMigration] ([Name])
    VALUES (N'20260814_body-measurements');
END

COMMIT TRANSACTION;
