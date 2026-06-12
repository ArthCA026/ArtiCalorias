-- ============================================================
-- changeForCalorieMode
-- Adds per-user calorie display mode preference to UserProfile.
-- Valid values: 'net' | 'goal' | 'adjusted'
-- Default: 'adjusted' (weekly-adjusted, existing app default)
-- ============================================================

ALTER TABLE [app].[UserProfile]
ADD [CalorieDisplayMode] NVARCHAR(20) NOT NULL
    CONSTRAINT [DF_UserProfile_CalorieDisplayMode] DEFAULT 'adjusted';
