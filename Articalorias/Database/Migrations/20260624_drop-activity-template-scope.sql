-- ============================================================
-- Migration: 20260624_drop-activity-template-scope
-- Description: Remove TemplateScope column from app.ActivityTemplate.
--              SYSTEM-scope templates are deleted first; check
--              constraints and the column are then dropped.
--              Constitution Principle VI: no speculative SYSTEM scope.
-- Idempotent: each step is guarded by existence checks.
-- Dependency: apply 20260622_drop-source-type-column.sql first.
-- ============================================================

-- Step 1: Delete all SYSTEM-scope rows (no-op if already absent)
IF COL_LENGTH('app.ActivityTemplate', 'TemplateScope') IS NOT NULL
    DELETE FROM [app].[ActivityTemplate] WHERE [TemplateScope] = 'SYSTEM';

-- Step 2: Drop check constraints (idempotent)
IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_ActivityTemplate_TemplateScope'
      AND parent_object_id = OBJECT_ID('app.ActivityTemplate')
)
    ALTER TABLE [app].[ActivityTemplate] DROP CONSTRAINT [CK_ActivityTemplate_TemplateScope];

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_ActivityTemplate_UserScope'
      AND parent_object_id = OBJECT_ID('app.ActivityTemplate')
)
    ALTER TABLE [app].[ActivityTemplate] DROP CONSTRAINT [CK_ActivityTemplate_UserScope];

-- Step 3: Drop the column
IF COL_LENGTH('app.ActivityTemplate', 'TemplateScope') IS NOT NULL
    ALTER TABLE [app].[ActivityTemplate] DROP COLUMN [TemplateScope];
