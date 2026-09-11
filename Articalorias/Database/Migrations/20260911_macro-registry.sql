-- ============================================================
-- Migration: 20260911_macro-registry
-- Description: Macros become catalog-driven JSON maps instead of one
--              column per nutrient, so adding a macro (caffeine, sodium,
--              fiber...) never needs a schema change again.
--
--   1. [app].[FoodEntry]    + [MacrosJson]       NVARCHAR(MAX)  TOTAL eaten, {"protein":12.5,...}
--   2. [app].[FoodTemplate] + [MacrosJson]       NVARCHAR(MAX)  per 1 portion
--   3. [app].[DailyLog]     + [MacroTotalsJson]  NVARCHAR(MAX)  day sums
--                             [MacroTargetsJson] widened to NVARCHAR(MAX)
--                             and now carrying protein too ({"k":"protein",...})
--   4. [app].[UserMacroPreference]
--                           - CK_UserMacroPreference_MacroKey (keys are open-ended now)
--                           + [AutoParam] DECIMAL(10,3) (protein g/kg preset)
--                           + one 'protein' row per existing profile, migrated
--                             from UserProfile.ProteinGoalGrams /
--                             AutoCalculateProteinGoal / ProteinGoalGramsPerKg
--
--   JSON semantics (deliberate): an ABSENT key means "not captured when
--   this was logged" (the old NULL), a present 0 is a real measurement.
--   FOR JSON PATH omits NULL columns, which is exactly that rule; the
--   NOT NULL core columns (protein/fat/carbs/alcohol) always appear.
--
--   The legacy columns are NOT dropped here. They stay untouched (with a
--   default added where one was missing) so the new build can insert
--   rows, and so this step can be verified and rolled back. Run
--   20260911_macro-registry-drop-legacy.sql once the deploy is verified.
--
--   Ops sequence: stop the API -> run this script -> deploy API + UI ->
--   start -> smoke test -> (later) run the drop-legacy script. If the old
--   build wrote rows between this script and the deploy, simply re-run
--   this script: the backfill blocks are re-runnable and only touch rows
--   whose JSON is still NULL or '{}' (the new code always writes at
--   least the core zeros).
--
-- Idempotent: sys.columns / sys.objects guards, COL_LENGTH guards on
-- the legacy columns (no-op after the drop script), one-shot parts
-- guarded by the app.DataMigration marker.
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

----------------------------------------------------------------
-- 1. New JSON columns (nullable first; tightened in step 7)
----------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[app].[FoodEntry]') AND name = N'MacrosJson')
BEGIN
    ALTER TABLE [app].[FoodEntry] ADD [MacrosJson] NVARCHAR(MAX) NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[app].[FoodTemplate]') AND name = N'MacrosJson')
BEGIN
    ALTER TABLE [app].[FoodTemplate] ADD [MacrosJson] NVARCHAR(MAX) NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[app].[DailyLog]') AND name = N'MacroTotalsJson')
BEGIN
    ALTER TABLE [app].[DailyLog] ADD [MacroTotalsJson] NVARCHAR(MAX) NULL;
END

----------------------------------------------------------------
-- 2. MacroTargetsJson: NVARCHAR(1000) -> NVARCHAR(MAX)
--    (protein plus any number of macros no longer fit a fixed width)
----------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID(N'[app].[DailyLog]')
             AND name = N'MacroTargetsJson'
             AND max_length <> -1)
BEGIN
    ALTER TABLE [app].[DailyLog] ALTER COLUMN [MacroTargetsJson] NVARCHAR(MAX) NULL;
END

----------------------------------------------------------------
-- 3. UserMacroPreference: open key set + auto-formula parameter
----------------------------------------------------------------
IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_UserMacroPreference_MacroKey'
      AND parent_object_id = OBJECT_ID(N'[app].[UserMacroPreference]')
)
BEGIN
    ALTER TABLE [app].[UserMacroPreference] DROP CONSTRAINT [CK_UserMacroPreference_MacroKey];
END

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID(N'[app].[UserMacroPreference]') AND name = N'AutoParam')
BEGIN
    ALTER TABLE [app].[UserMacroPreference] ADD [AutoParam] DECIMAL(10,3) NULL;
END

----------------------------------------------------------------
-- 4. Legacy NOT NULL column without a default: the new build no
--    longer writes SnapshotProteinGoalGrams, so INSERTs need one until
--    the drop-legacy script removes the column.
----------------------------------------------------------------
IF COL_LENGTH('app.DailyLog', 'SnapshotProteinGoalGrams') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1
        FROM sys.default_constraints dc
        INNER JOIN sys.columns c
            ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[app].[DailyLog]')
          AND c.name = N'SnapshotProteinGoalGrams')
BEGIN
    ALTER TABLE [app].[DailyLog]
        ADD CONSTRAINT [DF_DailyLog_SnapshotProteinGoal] DEFAULT ((0)) FOR [SnapshotProteinGoalGrams];
END

----------------------------------------------------------------
-- 5. Backfill the JSON maps from the legacy columns (re-runnable).
--    Dynamic SQL: the JSON columns are new in this batch. Guarded by
--    COL_LENGTH on the legacy columns so the script is a no-op once
--    the drop-legacy script has run.
----------------------------------------------------------------
DECLARE @n INT;

IF COL_LENGTH('app.FoodEntry', 'ProteinGrams') IS NOT NULL
BEGIN
    EXEC sp_executesql N'
        UPDATE e
        SET e.[MacrosJson] =
            (SELECT e.[ProteinGrams] AS [protein],
                    e.[FatGrams]     AS [fat],
                    e.[CarbsGrams]   AS [carbs],
                    e.[AlcoholGrams] AS [alcohol],
                    e.[SugarGrams]   AS [sugar],
                    e.[WaterMl]      AS [water]
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        FROM [app].[FoodEntry] e
        WHERE e.[MacrosJson] IS NULL OR e.[MacrosJson] = N''{}'';
        SET @n = @@ROWCOUNT;',
        N'@n INT OUTPUT', @n = @n OUTPUT;
    PRINT CONCAT('FoodEntry.MacrosJson backfilled: ', @n);
END

IF COL_LENGTH('app.FoodTemplate', 'ProteinGrams') IS NOT NULL
BEGIN
    EXEC sp_executesql N'
        UPDATE t
        SET t.[MacrosJson] =
            (SELECT t.[ProteinGrams] AS [protein],
                    t.[FatGrams]     AS [fat],
                    t.[CarbsGrams]   AS [carbs],
                    t.[AlcoholGrams] AS [alcohol],
                    t.[SugarGrams]   AS [sugar],
                    t.[WaterMl]      AS [water]
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        FROM [app].[FoodTemplate] t
        WHERE t.[MacrosJson] IS NULL OR t.[MacrosJson] = N''{}'';
        SET @n = @@ROWCOUNT;',
        N'@n INT OUTPUT', @n = @n OUTPUT;
    PRINT CONCAT('FoodTemplate.MacrosJson backfilled: ', @n);
END

IF COL_LENGTH('app.DailyLog', 'TotalProteinGrams') IS NOT NULL
BEGIN
    EXEC sp_executesql N'
        UPDATE d
        SET d.[MacroTotalsJson] =
            (SELECT d.[TotalProteinGrams] AS [protein],
                    d.[TotalFatGrams]     AS [fat],
                    d.[TotalCarbsGrams]   AS [carbs],
                    d.[TotalAlcoholGrams] AS [alcohol],
                    d.[TotalSugarGrams]   AS [sugar],
                    d.[TotalWaterMl]      AS [water]
             FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
        FROM [app].[DailyLog] d
        WHERE d.[MacroTotalsJson] IS NULL OR d.[MacroTotalsJson] = N''{}'';
        SET @n = @@ROWCOUNT;',
        N'@n INT OUTPUT', @n = @n OUTPUT;
    PRINT CONCAT('DailyLog.MacroTotalsJson backfilled: ', @n);
END

----------------------------------------------------------------
-- 6. One-shot data moves (marker-guarded)
----------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM [app].[DataMigration] WHERE [Name] = N'20260911_macro-registry')
BEGIN
    -- 6a. Protein joins the frozen day targets. Days whose snapshot goal
    --     was 0 stay as they are (no protein target = the old "no goal").
    --     Appended last; the reader re-sorts by catalog order.
    IF COL_LENGTH('app.DailyLog', 'SnapshotProteinGoalGrams') IS NOT NULL
    BEGIN
        UPDATE d
        SET d.[MacroTargetsJson] = JSON_MODIFY(
                ISNULL(d.[MacroTargetsJson], N'[]'),
                N'append $',
                JSON_QUERY(CONCAT(
                    N'{"k":"protein","t":',
                    CONVERT(NVARCHAR(20), d.[SnapshotProteinGoalGrams]),
                    N',"d":"hit"}')))
        FROM [app].[DailyLog] d
        WHERE d.[SnapshotProteinGoalGrams] > 0
          AND (d.[MacroTargetsJson] IS NULL OR ISJSON(d.[MacroTargetsJson]) = 1)
          AND ISNULL(d.[MacroTargetsJson], N'') NOT LIKE N'%"k":"protein"%';

        PRINT CONCAT('DailyLog protein targets appended: ', @@ROWCOUNT);
    END

    -- 6b. One protein preference row per existing profile, carrying the
    --     old profile settings over. tracked = auto mode OR a custom goal;
    --     auto param = the stored g/kg preset (NULL = the legacy 2.0).
    IF COL_LENGTH('app.UserProfile', 'AutoCalculateProteinGoal') IS NOT NULL
    BEGIN
        EXEC sp_executesql N'
            INSERT INTO [app].[UserMacroPreference]
                ([UserId], [MacroKey], [IsTracked], [TargetMode], [CustomTargetValue], [AutoParam])
            SELECT up.[UserId],
                   N''protein'',
                   CASE WHEN up.[AutoCalculateProteinGoal] = 1 OR up.[ProteinGoalGrams] > 0 THEN 1 ELSE 0 END,
                   CASE WHEN up.[AutoCalculateProteinGoal] = 1 THEN N''auto'' ELSE N''custom'' END,
                   CASE WHEN up.[AutoCalculateProteinGoal] = 1 THEN NULL ELSE up.[ProteinGoalGrams] END,
                   ISNULL(up.[ProteinGoalGramsPerKg], 2.0)
            FROM [app].[UserProfile] up
            WHERE NOT EXISTS (
                SELECT 1 FROM [app].[UserMacroPreference] m
                WHERE m.[UserId] = up.[UserId] AND m.[MacroKey] = N''protein'');
            SET @n = @@ROWCOUNT;',
            N'@n INT OUTPUT', @n = @n OUTPUT;
        PRINT CONCAT('Protein preference rows created: ', @n);
    END

    -- 6c. Cached AI answers from the old wire contract can never be
    --     replayed (the prompt version was bumped); free the space.
    IF OBJECT_ID(N'[app].[AiResponseCache]', N'U') IS NOT NULL
    BEGIN
        DELETE FROM [app].[AiResponseCache] WHERE [CacheType] IN (N'food', N'combined');
        PRINT CONCAT('Stale AI cache rows removed: ', @@ROWCOUNT);
    END

    INSERT INTO [app].[DataMigration] ([Name]) VALUES (N'20260911_macro-registry');
END

----------------------------------------------------------------
-- 7. Tighten: NOT NULL with DEFAULT '{}' (dynamic SQL, new columns)
----------------------------------------------------------------
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID(N'[app].[FoodEntry]') AND name = N'MacrosJson' AND is_nullable = 1)
BEGIN
    EXEC sp_executesql N'UPDATE [app].[FoodEntry] SET [MacrosJson] = N''{}'' WHERE [MacrosJson] IS NULL;';
    IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = N'DF_FoodEntry_MacrosJson')
        EXEC sp_executesql N'ALTER TABLE [app].[FoodEntry] ADD CONSTRAINT [DF_FoodEntry_MacrosJson] DEFAULT (N''{}'') FOR [MacrosJson];';
    EXEC sp_executesql N'ALTER TABLE [app].[FoodEntry] ALTER COLUMN [MacrosJson] NVARCHAR(MAX) NOT NULL;';
END

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID(N'[app].[FoodTemplate]') AND name = N'MacrosJson' AND is_nullable = 1)
BEGIN
    EXEC sp_executesql N'UPDATE [app].[FoodTemplate] SET [MacrosJson] = N''{}'' WHERE [MacrosJson] IS NULL;';
    IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = N'DF_FoodTemplate_MacrosJson')
        EXEC sp_executesql N'ALTER TABLE [app].[FoodTemplate] ADD CONSTRAINT [DF_FoodTemplate_MacrosJson] DEFAULT (N''{}'') FOR [MacrosJson];';
    EXEC sp_executesql N'ALTER TABLE [app].[FoodTemplate] ALTER COLUMN [MacrosJson] NVARCHAR(MAX) NOT NULL;';
END

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID(N'[app].[DailyLog]') AND name = N'MacroTotalsJson' AND is_nullable = 1)
BEGIN
    EXEC sp_executesql N'UPDATE [app].[DailyLog] SET [MacroTotalsJson] = N''{}'' WHERE [MacroTotalsJson] IS NULL;';
    IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = N'DF_DailyLog_MacroTotalsJson')
        EXEC sp_executesql N'ALTER TABLE [app].[DailyLog] ADD CONSTRAINT [DF_DailyLog_MacroTotalsJson] DEFAULT (N''{}'') FOR [MacroTotalsJson];';
    EXEC sp_executesql N'ALTER TABLE [app].[DailyLog] ALTER COLUMN [MacroTotalsJson] NVARCHAR(MAX) NOT NULL;';
END

COMMIT TRANSACTION;
