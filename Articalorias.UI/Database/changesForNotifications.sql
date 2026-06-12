-- ============================================================
-- AddNotificationSchedules
-- Adds per-user meal reminder schedules (Breakfast/Lunch/Dinner)
-- Type values:  1 = Breakfast  |  2 = Lunch  |  3 = Dinner
-- ============================================================

CREATE TABLE [dbo].[NotificationSchedules] (
    [NotificationScheduleId] BIGINT       IDENTITY(1,1) NOT NULL,
    [UserId]                 BIGINT                     NOT NULL,
    [Type]                   INT                        NOT NULL,
    [Enabled]                BIT                        NOT NULL,
    [HourUtc]                INT                        NOT NULL,
    [MinuteUtc]              INT                        NOT NULL,
    [UpdatedAtUtc]           DATETIME2                  NOT NULL,

    CONSTRAINT [PK_NotificationSchedules]
        PRIMARY KEY CLUSTERED ([NotificationScheduleId]),

    CONSTRAINT [FK_NotificationSchedules_User_UserId]
        FOREIGN KEY ([UserId])
        REFERENCES [app].[User] ([UserId])
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX [IX_NotificationSchedules_UserId_Type]
    ON [dbo].[NotificationSchedules] ([UserId], [Type]);
