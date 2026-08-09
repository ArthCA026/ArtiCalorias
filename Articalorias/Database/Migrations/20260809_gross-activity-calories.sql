-- ============================================================
-- Migration: 20260809_gross-activity-calories
-- Description: Converts stored activity calories from the old
--              NET convention ((MET - 1) x weight x hours) to
--              the new GROSS convention (MET x weight x hours),
--              which includes the resting burn of the activity
--              timeframe, matching what smart watches report.
--
--              For every MET-based entry the difference is
--              exactly weight x hours (1 kcal/kg/h, the MET
--              reference rate), so:
--                1. Each ActivityEntry gains weight x hours.
--                2. Each DailyLog's TotalActivityCaloriesKcal
--                   gains the same summed amount.
--                3. NOTHING ELSE changes: TotalDailyExpenditure,
--                   NetBalance, weekly fields and frozen adjusted
--                   budgets stay byte-identical, because the new
--                   API subtracts the same resting offset from
--                   the BMR line when it recalculates.
--
-- IMPORTANT: Deploy the updated API together with this script.
--            Run the script while the OLD API is stopped (or
--            immediately after deploying the new one): the old
--            binary would recalculate migrated days back to net.
--
-- Idempotent: guarded by a row in [app].[DataMigration], created
--             here if missing, so running it twice is harmless.
-- ============================================================

SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- 0. Marker table for one-shot data migrations
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

IF NOT EXISTS (
    SELECT 1 FROM [app].[DataMigration]
    WHERE [Name] = N'20260809_gross-activity-calories'
)
BEGIN
    ----------------------------------------------------------------
    -- 1. Entries: net -> gross (+ weight x hours per entry).
    --    Only MET-based entries: those are the ones the old formula
    --    computed. Entries without MET or duration keep their value.
    --    A day with no snapshot weight contributed 0 kcal under both
    --    conventions, so ISNULL(weight, 0) is exact there too.
    ----------------------------------------------------------------
    UPDATE ae
    SET ae.[CalculatedCaloriesKcal] =
            ae.[CalculatedCaloriesKcal]
            + ISNULL(dl.[SnapshotWeightKg], 0) * ae.[DurationMinutes] / 60.0
    FROM [app].[ActivityEntry] ae
    INNER JOIN [app].[DailyLog] dl
        ON dl.[DailyLogId] = ae.[DailyLogId]
    WHERE ae.[METValue] IS NOT NULL
      AND ae.[DurationMinutes] IS NOT NULL;

    ----------------------------------------------------------------
    -- 2. Day totals: keep TotalActivityCaloriesKcal equal to the sum
    --    of its (now gross) entries by adding the same per-day delta.
    --    TotalDailyExpenditureKcal, NetBalanceKcal and every weekly
    --    field are deliberately NOT touched: the total burn of each
    --    day is unchanged by design.
    ----------------------------------------------------------------
    UPDATE dl
    SET dl.[TotalActivityCaloriesKcal] =
            dl.[TotalActivityCaloriesKcal] + delta.[RestingShareKcal]
    FROM [app].[DailyLog] dl
    INNER JOIN
    (
        SELECT ae.[DailyLogId],
               SUM(ISNULL(dl2.[SnapshotWeightKg], 0) * ae.[DurationMinutes] / 60.0) AS [RestingShareKcal]
        FROM [app].[ActivityEntry] ae
        INNER JOIN [app].[DailyLog] dl2
            ON dl2.[DailyLogId] = ae.[DailyLogId]
        WHERE ae.[METValue] IS NOT NULL
          AND ae.[DurationMinutes] IS NOT NULL
        GROUP BY ae.[DailyLogId]
    ) AS delta
        ON delta.[DailyLogId] = dl.[DailyLogId];

    INSERT INTO [app].[DataMigration] ([Name])
    VALUES (N'20260809_gross-activity-calories');
END

COMMIT TRANSACTION;
