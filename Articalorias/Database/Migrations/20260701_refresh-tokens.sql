-- ============================================================
-- Migration: 20260701_refresh-tokens
-- Description: Add app.RefreshTokens table to support the
--              refresh-token rotation flow. Each row represents
--              one issued refresh token (stored as a SHA-256 hash).
--              Tokens are revoked on use (rotation) or on logout.
-- Idempotent: all DDL guarded by sys.objects / sys.indexes checks.
-- ============================================================

-- Table
IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[app].[RefreshTokens]')
      AND type = 'U'
)
BEGIN
    CREATE TABLE [app].[RefreshTokens] (
        [Id]              BIGINT          IDENTITY(1,1) NOT NULL,
        [UserId]          BIGINT          NOT NULL,
        [TokenHash]       NVARCHAR(256)   NOT NULL,
        [ExpiresAtUtc]    DATETIME2(0)    NOT NULL,
        [CreatedAtUtc]    DATETIME2(0)    NOT NULL CONSTRAINT [DF_RefreshTokens_CreatedAtUtc] DEFAULT SYSUTCDATETIME(),
        [RevokedAtUtc]    DATETIME2(0)    NULL,

        CONSTRAINT [PK_RefreshTokens] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_RefreshTokens_Users]
            FOREIGN KEY ([UserId]) REFERENCES [app].[User] ([UserId])
            ON DELETE CASCADE
    );
END;

-- Unique index on TokenHash (the main lookup path)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[app].[RefreshTokens]')
      AND name = N'UQ_RefreshTokens_TokenHash'
)
    CREATE UNIQUE INDEX [UQ_RefreshTokens_TokenHash]
        ON [app].[RefreshTokens] ([TokenHash]);

-- Composite index for per-user cleanup queries
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[app].[RefreshTokens]')
      AND name = N'IX_RefreshTokens_UserId_ExpiresAtUtc'
)
    CREATE INDEX [IX_RefreshTokens_UserId_ExpiresAtUtc]
        ON [app].[RefreshTokens] ([UserId], [ExpiresAtUtc]);
