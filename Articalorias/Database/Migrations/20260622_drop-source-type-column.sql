-- ============================================================
-- Migration: 20260622_drop-source-type-column
-- Description: Remove SourceType column from app.FoodEntry.
--              Constitution Principle V: no SourceType column.
-- Idempotent: each DROP is guarded by existence checks.
-- ============================================================

-- Step 1: Drop the CHECK constraint blocking the column drop
IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_FoodEntry_SourceType'
      AND parent_object_id = OBJECT_ID('app.FoodEntry')
)
    ALTER TABLE [app].[FoodEntry] DROP CONSTRAINT [CK_FoodEntry_SourceType];

-- Step 2: Drop the column
IF COL_LENGTH('app.FoodEntry', 'SourceType') IS NOT NULL
    ALTER TABLE [app].[FoodEntry] DROP COLUMN [SourceType];