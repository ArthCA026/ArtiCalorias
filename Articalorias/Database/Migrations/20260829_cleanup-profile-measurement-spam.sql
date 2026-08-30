-- ============================================================
-- Migration: 20260829_cleanup-profile-measurement-spam
-- Description: Data repair for the Body graph.
--
-- Bug: EVERY profile save recorded a "profile"-sourced measurement for
-- the local day — including saves that had nothing to do with the body
-- (switching the calorie display mode, toggling the safeguard, editing
-- reminders). Users who touched any setting daily accumulated one
-- identical weight point per day, flooding the graph. The code fix
-- records a point only when the weight or a manually entered body fat
-- actually changed; this script removes the noise already written.
--
-- Rule: delete 'profile'-sourced rows whose values exactly repeat the
-- measurement immediately before them (per user, by date, NULL-safe on
-- both weight and body fat). The FIRST row of every identical run is
-- kept — that is the point where the value genuinely became current.
-- 'manual' and 'history' rows are never touched: a hand-entered
-- weigh-in that happens to repeat yesterday's number is real data.
--
-- Deleting a redundant newest row is safe for the profile-sync logic:
-- the surviving newest row carries the exact same values.
--
-- Idempotent by nature (a second run finds no more redundant rows);
-- additionally marker-guarded to keep reruns cheap and auditable.
-- ============================================================

SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- Marker table (created by earlier migrations; guarded for fresh DBs).
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

IF NOT EXISTS (SELECT 1 FROM [app].[DataMigration] WHERE [Name] = N'20260829_cleanup-profile-measurement-spam')
BEGIN
    ;WITH Ordered AS
    (
        SELECT
            m.[BodyMeasurementId],
            m.[Source],
            m.[WeightKg],
            m.[BodyFatPercent],
            LAG(m.[WeightKg])       OVER (PARTITION BY m.[UserId] ORDER BY m.[MeasuredOn]) AS PrevWeightKg,
            LAG(m.[BodyFatPercent]) OVER (PARTITION BY m.[UserId] ORDER BY m.[MeasuredOn]) AS PrevBodyFatPercent,
            LAG(m.[BodyMeasurementId]) OVER (PARTITION BY m.[UserId] ORDER BY m.[MeasuredOn]) AS PrevId
    FROM [app].[BodyMeasurement] m
    )
    DELETE m
    FROM [app].[BodyMeasurement] m
    JOIN Ordered o ON o.[BodyMeasurementId] = m.[BodyMeasurementId]
    WHERE o.[Source] = N'profile'
      AND o.[PrevId] IS NOT NULL
      -- NULL-safe equality on both values: the row adds no information.
      AND EXISTS (SELECT o.[WeightKg]       INTERSECT SELECT o.[PrevWeightKg])
      AND EXISTS (SELECT o.[BodyFatPercent] INTERSECT SELECT o.[PrevBodyFatPercent]);

    PRINT CONCAT('Redundant profile measurements removed: ', @@ROWCOUNT);

    INSERT INTO [app].[DataMigration] ([Name]) VALUES (N'20260829_cleanup-profile-measurement-spam');
END

COMMIT TRANSACTION;
