-- 2026-07-02 · Make weight and height optional on UserProfile and DailyLog
-- Allows users to onboard/use the app without providing body metrics.
-- Calorie budget estimates (TDEE) are suppressed when either column is NULL.

ALTER TABLE app.UserProfile ALTER COLUMN CurrentWeightKg decimal(8,2) NULL;
ALTER TABLE app.UserProfile ALTER COLUMN HeightCm          decimal(8,2) NULL;

ALTER TABLE app.DailyLog ALTER COLUMN SnapshotWeightKg decimal(8,2) NULL;
ALTER TABLE app.DailyLog ALTER COLUMN SnapshotHeightCm decimal(8,2) NULL;
