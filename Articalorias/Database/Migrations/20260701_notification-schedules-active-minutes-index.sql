-- ============================================================
-- Migration: 20260701_notification-schedules-active-minutes-index
-- Description: Add a filtered index on dbo.NotificationSchedules
--              (HourUtc, MinuteUtc) WHERE Enabled = 1 so that
--              MealReminderService's per-minute point-lookup uses
--              an index seek instead of a full scan.
-- Idempotent: guarded by sys.indexes existence check.
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.NotificationSchedules')
      AND name = 'IX_NotificationSchedules_HourUtc_MinuteUtc_Enabled'
)
    CREATE INDEX [IX_NotificationSchedules_HourUtc_MinuteUtc_Enabled]
        ON [dbo].[NotificationSchedules] ([HourUtc], [MinuteUtc])
        WHERE [Enabled] = 1;
