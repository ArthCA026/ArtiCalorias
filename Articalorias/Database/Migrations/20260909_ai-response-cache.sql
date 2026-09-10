-- ============================================================
-- Migration: 20260909_ai-response-cache
-- Description: Shared cache of AI parsing responses (cost control).
--
--   New table [app].[AiResponseCache] - one row per unique parsing
--   input, shared by ALL users. Identical inputs ("2 huevos",
--   "corri 30 min", MET lookups) stop paying for a fresh OpenAI
--   call every time.
--
--   CacheKeyHash: SHA-256 (lowercase hex) of the normalized input
--     plus prompt version, model, country and tracked-macro options.
--     The raw input text is deliberately NOT stored, and no column
--     references a user: meal/activity text is health data under
--     Ley 8968 only while linked to a person - this table holds
--     anonymous phrase-level knowledge ("1 egg is ~70 kcal").
--   CacheType:  'food' | 'activity' | 'met' | 'combined'
--   ExpiresAtUtc: NULL = never expires (MET estimates are
--     deterministic by design); parse entries get a rolling TTL
--     (default 30 days, config OpenAI:ParseCacheTtlDays).
--   HitCount/LastHitAtUtc: telemetry for tuning and cleanup.
--
--   Expired rows are deleted opportunistically by the app on cache
--   writes; no scheduled job is required.
--
-- Idempotent: guarded by sys.objects check.
-- ============================================================

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[app].[AiResponseCache]')
      AND type = 'U'
)
BEGIN
    CREATE TABLE [app].[AiResponseCache]
    (
        [CacheKeyHash]  CHAR(64)      NOT NULL,
        [CacheType]     NVARCHAR(20)  NOT NULL,
        [ResponseJson]  NVARCHAR(MAX) NOT NULL,
        [CreatedAtUtc]  DATETIME2(0)  NOT NULL CONSTRAINT [DF_AiResponseCache_CreatedAtUtc] DEFAULT SYSUTCDATETIME(),
        [ExpiresAtUtc]  DATETIME2(0)  NULL,
        [HitCount]      BIGINT        NOT NULL CONSTRAINT [DF_AiResponseCache_HitCount] DEFAULT 0,
        [LastHitAtUtc]  DATETIME2(0)  NOT NULL CONSTRAINT [DF_AiResponseCache_LastHitAtUtc] DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_AiResponseCache] PRIMARY KEY ([CacheKeyHash]),
        CONSTRAINT [CK_AiResponseCache_Type]
            CHECK ([CacheType] IN (N'food', N'activity', N'met', N'combined'))
    );

    -- Supports the opportunistic DELETE of expired rows.
    CREATE INDEX [IX_AiResponseCache_Expires]
        ON [app].[AiResponseCache] ([ExpiresAtUtc])
        WHERE [ExpiresAtUtc] IS NOT NULL;
END

COMMIT TRANSACTION;
