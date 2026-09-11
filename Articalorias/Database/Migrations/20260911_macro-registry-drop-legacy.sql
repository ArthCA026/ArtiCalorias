-- ============================================================
-- Migration: 20260911_macro-registry-drop-legacy
-- Description: Second half of the macro registry migration. Removes
--              the per-macro columns that 20260911_macro-registry.sql
--              copied into the JSON maps.
--
--   RUN ONLY AFTER: 20260911_macro-registry.sql is applied, the new
--   build is deployed, and dashboards / history / templates / export
--   have been verified against real data. There is no rollback once
--   these columns are gone (other than a database restore).
--
--   Drops (default constraints resolved by column, since the SSMS-
--   generated baseline may name them differently per environment):
--     [app].[FoodEntry]    ProteinGrams, FatGrams, CarbsGrams, AlcoholGrams, SugarGrams, WaterMl
--     [app].[FoodTemplate] ProteinGrams, FatGrams, CarbsGrams, AlcoholGrams, SugarGrams, WaterMl
--     [app].[DailyLog]     SnapshotProteinGoalGrams, TotalProteinGrams, TotalFatGrams,
--                          TotalCarbsGrams, TotalAlcoholGrams, TotalSugarGrams,
--                          TotalWaterMl, ProteinRemainingGrams
--     [app].[UserProfile]  ProteinGoalGrams, AutoCalculateProteinGoal, ProteinGoalGramsPerKg
--
--   Safety: refuses to run (THROW, transaction rolled back) unless the
--   first script's marker exists and every row already carries its JSON.
--
--   Afterwards regenerate Database/Migrations/articaloriasdb.sql from
--   SSMS (UTF-16LE); do not hand-edit it.
--
-- Idempotent: every DROP is guarded by COL_LENGTH.
-- ============================================================

SET XACT_ABORT ON;
BEGIN TRANSACTION;

----------------------------------------------------------------
-- 0. Guards
----------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM [app].[DataMigration] WHERE [Name] = N'20260911_macro-registry')
    THROW 50001, N'20260911_macro-registry has not been applied; refusing to drop the legacy macro columns.', 1;

IF EXISTS (SELECT 1 FROM [app].[FoodEntry]
           WHERE [MacrosJson] IS NULL OR [MacrosJson] IN (N'', N'{}') OR ISJSON([MacrosJson]) = 0)
    THROW 50002, N'FoodEntry rows without macro JSON exist; re-run 20260911_macro-registry.sql first.', 1;

IF EXISTS (SELECT 1 FROM [app].[FoodTemplate]
           WHERE [MacrosJson] IS NULL OR [MacrosJson] IN (N'', N'{}') OR ISJSON([MacrosJson]) = 0)
    THROW 50003, N'FoodTemplate rows without macro JSON exist; re-run 20260911_macro-registry.sql first.', 1;

IF EXISTS (SELECT 1 FROM [app].[DailyLog]
           WHERE [MacroTotalsJson] IS NULL OR [MacroTotalsJson] = N'' OR ISJSON([MacroTotalsJson]) = 0)
    THROW 50004, N'DailyLog rows without totals JSON exist; re-run 20260911_macro-registry.sql first.', 1;

IF EXISTS (SELECT 1 FROM [app].[UserProfile] up
           WHERE NOT EXISTS (SELECT 1 FROM [app].[UserMacroPreference] m
                             WHERE m.[UserId] = up.[UserId] AND m.[MacroKey] = N'protein'))
    THROW 50005, N'Profiles without a protein preference row exist; re-run 20260911_macro-registry.sql first.', 1;

----------------------------------------------------------------
-- 1. Drop the legacy columns (default constraint first, by column)
----------------------------------------------------------------
DECLARE @drops TABLE ([Tbl] SYSNAME, [Col] SYSNAME);
INSERT INTO @drops ([Tbl], [Col]) VALUES
    (N'FoodEntry',    N'ProteinGrams'),
    (N'FoodEntry',    N'FatGrams'),
    (N'FoodEntry',    N'CarbsGrams'),
    (N'FoodEntry',    N'AlcoholGrams'),
    (N'FoodEntry',    N'SugarGrams'),
    (N'FoodEntry',    N'WaterMl'),
    (N'FoodTemplate', N'ProteinGrams'),
    (N'FoodTemplate', N'FatGrams'),
    (N'FoodTemplate', N'CarbsGrams'),
    (N'FoodTemplate', N'AlcoholGrams'),
    (N'FoodTemplate', N'SugarGrams'),
    (N'FoodTemplate', N'WaterMl'),
    (N'DailyLog',     N'SnapshotProteinGoalGrams'),
    (N'DailyLog',     N'TotalProteinGrams'),
    (N'DailyLog',     N'TotalFatGrams'),
    (N'DailyLog',     N'TotalCarbsGrams'),
    (N'DailyLog',     N'TotalAlcoholGrams'),
    (N'DailyLog',     N'TotalSugarGrams'),
    (N'DailyLog',     N'TotalWaterMl'),
    (N'DailyLog',     N'ProteinRemainingGrams'),
    (N'UserProfile',  N'ProteinGoalGrams'),
    (N'UserProfile',  N'AutoCalculateProteinGoal'),
    (N'UserProfile',  N'ProteinGoalGramsPerKg');

DECLARE @tbl SYSNAME, @col SYSNAME, @df SYSNAME, @sql NVARCHAR(MAX);

DECLARE drops_cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT [Tbl], [Col] FROM @drops;

OPEN drops_cur;
FETCH NEXT FROM drops_cur INTO @tbl, @col;

WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH(N'app.' + @tbl, @col) IS NOT NULL
    BEGIN
        SET @df = NULL;
        SELECT @df = dc.[name]
        FROM sys.default_constraints dc
        INNER JOIN sys.columns c
            ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID(N'[app].[' + @tbl + N']')
          AND c.[name] = @col;

        IF @df IS NOT NULL
        BEGIN
            SET @sql = N'ALTER TABLE [app].[' + @tbl + N'] DROP CONSTRAINT [' + @df + N'];';
            EXEC sp_executesql @sql;
        END

        SET @sql = N'ALTER TABLE [app].[' + @tbl + N'] DROP COLUMN [' + @col + N'];';
        EXEC sp_executesql @sql;

        PRINT CONCAT('Dropped app.', @tbl, '.', @col);
    END

    FETCH NEXT FROM drops_cur INTO @tbl, @col;
END

CLOSE drops_cur;
DEALLOCATE drops_cur;

IF NOT EXISTS (SELECT 1 FROM [app].[DataMigration] WHERE [Name] = N'20260911_macro-registry-drop-legacy')
    INSERT INTO [app].[DataMigration] ([Name]) VALUES (N'20260911_macro-registry-drop-legacy');

COMMIT TRANSACTION;
