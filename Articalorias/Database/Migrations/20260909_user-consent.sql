-- ============================================================
-- Migration: 20260909_user-consent
-- Description: Informed-consent audit log (Ley 8968).
--
--   New table [app].[UserConsent] - append-only: one row per consent
--   EVENT (a grant or a revocation of one consent type at one policy
--   version, in the language it was shown). Rows are never updated;
--   the user's current state is the latest row per (UserId, ConsentType).
--
--   ConsentType: 'terms' | 'privacy' | 'health_data'
--   Action:      'granted' | 'revoked'
--   Source:      'register' | 'reconsent' | 'profile'
--
--   No backfill by design: existing users have never consented, so the
--   app gates them at next sign-in until they actively accept. Consent
--   evidence must never be fabricated.
--
--   FK cascades with the user row, so account deletion keeps erasing
--   everything. Whether an anonymized consent log should instead
--   survive deletion is an open question for counsel (docs/legal).
--
-- Idempotent: guarded by sys.objects check.
-- ============================================================

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE object_id = OBJECT_ID(N'[app].[UserConsent]')
      AND type = 'U'
)
BEGIN
    CREATE TABLE [app].[UserConsent]
    (
        [UserConsentId] BIGINT IDENTITY(1,1) NOT NULL,
        [UserId]        BIGINT        NOT NULL,
        [ConsentType]   NVARCHAR(30)  NOT NULL,
        [PolicyVersion] NVARCHAR(20)  NOT NULL,
        [Action]        NVARCHAR(10)  NOT NULL,
        [Locale]        NVARCHAR(5)   NOT NULL,
        [Source]        NVARCHAR(20)  NOT NULL,
        [CreatedAtUtc]  DATETIME2(0)  NOT NULL CONSTRAINT [DF_UserConsent_CreatedAtUtc] DEFAULT SYSUTCDATETIME(),

        CONSTRAINT [PK_UserConsent] PRIMARY KEY ([UserConsentId]),
        CONSTRAINT [FK_UserConsent_User] FOREIGN KEY ([UserId])
            REFERENCES [app].[User] ([UserId]) ON DELETE CASCADE,
        CONSTRAINT [CK_UserConsent_Type]
            CHECK ([ConsentType] IN (N'terms', N'privacy', N'health_data')),
        CONSTRAINT [CK_UserConsent_Action]
            CHECK ([Action] IN (N'granted', N'revoked'))
    );

    CREATE INDEX [IX_UserConsent_User_Type_Created]
        ON [app].[UserConsent] ([UserId], [ConsentType], [CreatedAtUtc] DESC);
END

COMMIT TRANSACTION;
