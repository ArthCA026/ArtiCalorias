-- ============================================================
-- Migration: 20260918_billing-subscriptions
-- Description: Subscription billing through ONVO Pay.
--
--   [app].[UserSubscription] - local mirror of one ONVO recurring charge.
--     ONVO is the source of truth; the row is refreshed from the ONVO API
--     (never from a webhook body) so the access check is a local query.
--     PaidThroughUtc = end of the last period whose payment was VERIFIED;
--     it is the only column that grants access. NULL = never paid.
--     OnvoMode ('test' | 'live') keeps test-card purchases from ever
--     unlocking a live deployment.
--
--   [app].[BillingPrice] - cache of the ONVO product/price ids behind each
--     catalogue plan, created lazily by the first checkout. Keyed by mode
--     and amount, so a price change mints a new ONVO price. Not user data.
--
--   [app].[BillingEvent] - append-only billing audit trail (what was agreed
--     to at checkout, verified payments, cancellations). Evidence for
--     disputes. (EventType, DedupeKey) is unique when a key is set, which
--     makes activation / renewal / failure events write-once under
--     webhook redelivery and concurrent syncs.
--
--   Both user tables cascade with [app].[User]: account deletion keeps
--   erasing everything (the API cancels the ONVO subscription first).
--   BillingEvent.UserSubscriptionId is deliberately NOT a foreign key:
--   SQL Server rejects a second cascade path from [User].
--
--   No backfill: nobody has a subscription yet. Existing accounts see the
--   paywall once Billing:Enabled is true, unless their UserId is listed in
--   Configuration/SubscriptionWhitelist.cs.
--
-- Idempotent: every table (with its indexes) is guarded by a sys.objects check.
-- ============================================================

-- The filtered unique index on BillingEvent needs these ON. SSMS and the API
-- already run with them ON; sqlcmd does not unless told (or run with -I).
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[app].[UserSubscription]')
      AND type = 'U'
)
BEGIN
    CREATE TABLE [app].[UserSubscription]
    (
        [UserSubscriptionId]    BIGINT IDENTITY(1,1) NOT NULL,
        [UserId]                BIGINT        NOT NULL,
        [OnvoMode]              NVARCHAR(8)   NOT NULL,
        [OnvoCustomerId]        NVARCHAR(64)  NOT NULL,
        [OnvoSubscriptionId]    NVARCHAR(64)  NOT NULL,
        [PlanCode]              NVARCHAR(16)  NOT NULL,
        [PriceCents]            INT           NOT NULL,
        [Currency]              NVARCHAR(3)   NOT NULL,
        [Status]                NVARCHAR(24)  NOT NULL,
        [CancelAtPeriodEnd]     BIT           NOT NULL CONSTRAINT [DF_UserSubscription_CancelAtPeriodEnd] DEFAULT (0),
        [CurrentPeriodStartUtc] DATETIME2(0)  NULL,
        [CurrentPeriodEndUtc]   DATETIME2(0)  NULL,
        [PaidThroughUtc]        DATETIME2(0)  NULL,
        [LastPaymentIntentId]   NVARCHAR(64)  NULL,
        [CanceledAtUtc]         DATETIME2(0)  NULL,
        [LastSyncedAtUtc]       DATETIME2(0)  NULL,
        [CreatedAtUtc]          DATETIME2(0)  NOT NULL CONSTRAINT [DF_UserSubscription_CreatedAtUtc] DEFAULT SYSUTCDATETIME(),
        [UpdatedAtUtc]          DATETIME2(0)  NOT NULL CONSTRAINT [DF_UserSubscription_UpdatedAtUtc] DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_UserSubscription] PRIMARY KEY ([UserSubscriptionId]),
        CONSTRAINT [FK_UserSubscription_User] FOREIGN KEY ([UserId])
            REFERENCES [app].[User] ([UserId]) ON DELETE CASCADE,
        CONSTRAINT [CK_UserSubscription_Mode]
            CHECK ([OnvoMode] IN (N'test', N'live')),
        CONSTRAINT [CK_UserSubscription_Plan]
            CHECK ([PlanCode] IN (N'monthly', N'yearly')),
        CONSTRAINT [CK_UserSubscription_Price]
            CHECK ([PriceCents] > 0)
    );

    CREATE UNIQUE INDEX [UX_UserSubscription_OnvoSubscriptionId]
        ON [app].[UserSubscription] ([OnvoSubscriptionId]);

    CREATE INDEX [IX_UserSubscription_User_Mode_Created]
        ON [app].[UserSubscription] ([UserId], [OnvoMode], [CreatedAtUtc] DESC);

    CREATE INDEX [IX_UserSubscription_OnvoCustomerId]
        ON [app].[UserSubscription] ([OnvoCustomerId]);
END

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[app].[BillingPrice]')
      AND type = 'U'
)
BEGIN
    CREATE TABLE [app].[BillingPrice]
    (
        [BillingPriceId]  INT IDENTITY(1,1) NOT NULL,
        [OnvoMode]        NVARCHAR(8)   NOT NULL,
        [PlanCode]        NVARCHAR(16)  NOT NULL,
        [Currency]        NVARCHAR(3)   NOT NULL,
        [UnitAmountCents] INT           NOT NULL,
        [OnvoProductId]   NVARCHAR(64)  NOT NULL,
        [OnvoPriceId]     NVARCHAR(64)  NOT NULL,
        [CreatedAtUtc]    DATETIME2(0)  NOT NULL CONSTRAINT [DF_BillingPrice_CreatedAtUtc] DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_BillingPrice] PRIMARY KEY ([BillingPriceId]),
        CONSTRAINT [CK_BillingPrice_Mode]
            CHECK ([OnvoMode] IN (N'test', N'live'))
    );

    CREATE UNIQUE INDEX [UX_BillingPrice_Mode_Plan_Currency_Amount]
        ON [app].[BillingPrice] ([OnvoMode], [PlanCode], [Currency], [UnitAmountCents]);
END

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[app].[BillingEvent]')
      AND type = 'U'
)
BEGIN
    CREATE TABLE [app].[BillingEvent]
    (
        [BillingEventId]     BIGINT IDENTITY(1,1) NOT NULL,
        [UserId]             BIGINT         NOT NULL,
        [UserSubscriptionId] BIGINT         NULL,
        [EventType]          NVARCHAR(40)   NOT NULL,
        [DedupeKey]          NVARCHAR(100)  NULL,
        [Detail]             NVARCHAR(1000) NULL,
        [CreatedAtUtc]       DATETIME2(0)   NOT NULL CONSTRAINT [DF_BillingEvent_CreatedAtUtc] DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_BillingEvent] PRIMARY KEY ([BillingEventId]),
        CONSTRAINT [FK_BillingEvent_User] FOREIGN KEY ([UserId])
            REFERENCES [app].[User] ([UserId]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_BillingEvent_User_Created]
        ON [app].[BillingEvent] ([UserId], [CreatedAtUtc] DESC);

    CREATE UNIQUE INDEX [UX_BillingEvent_Type_DedupeKey]
        ON [app].[BillingEvent] ([EventType], [DedupeKey])
        WHERE [DedupeKey] IS NOT NULL;
END

COMMIT TRANSACTION;
