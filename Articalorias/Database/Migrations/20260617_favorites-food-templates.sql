-- =====================================================================
-- Migration: 2026-06-17  Favorites — Food Templates, FK on FoodEntry,
--             FavoriteRoutine, FavoriteRoutineItem
-- =====================================================================

-- 1. FoodTemplate table
IF OBJECT_ID('app.FoodTemplate', 'U') IS NULL
BEGIN
    CREATE TABLE app.FoodTemplate (
        FoodTemplateId    bigint          IDENTITY(1,1) NOT NULL,
        UserId            bigint          NOT NULL,
        TemplateName      nvarchar(150)   NOT NULL,
        PortionDescription nvarchar(100)  NOT NULL,
        DefaultQuantity   decimal(10,3)   NOT NULL CONSTRAINT DF_FoodTemplate_DefaultQuantity   DEFAULT 1,
        CaloriesKcal      decimal(10,2)   NOT NULL CONSTRAINT DF_FoodTemplate_CaloriesKcal      DEFAULT 0,
        ProteinGrams      decimal(10,2)   NOT NULL CONSTRAINT DF_FoodTemplate_ProteinGrams      DEFAULT 0,
        FatGrams          decimal(10,2)   NOT NULL CONSTRAINT DF_FoodTemplate_FatGrams          DEFAULT 0,
        CarbsGrams        decimal(10,2)   NOT NULL CONSTRAINT DF_FoodTemplate_CarbsGrams        DEFAULT 0,
        AlcoholGrams      decimal(10,2)   NOT NULL CONSTRAINT DF_FoodTemplate_AlcoholGrams      DEFAULT 0,
        AutoAddToNewDay   bit             NOT NULL CONSTRAINT DF_FoodTemplate_AutoAddToNewDay   DEFAULT 0,
        IsActive          bit             NOT NULL CONSTRAINT DF_FoodTemplate_IsActive          DEFAULT 1,
        CreatedAtUtc      datetime2(0)    NOT NULL CONSTRAINT DF_FoodTemplate_CreatedAtUtc      DEFAULT SYSUTCDATETIME(),
        UpdatedAtUtc      datetime2(0)    NOT NULL CONSTRAINT DF_FoodTemplate_UpdatedAtUtc      DEFAULT SYSUTCDATETIME(),
        RowVersion        rowversion      NOT NULL,
        CONSTRAINT PK_FoodTemplate PRIMARY KEY (FoodTemplateId),
        CONSTRAINT FK_FoodTemplate_User FOREIGN KEY (UserId)
            REFERENCES app.[User](UserId)
    );
    CREATE INDEX IX_FoodTemplate_UserId ON app.FoodTemplate (UserId, IsActive, TemplateName);
END;

-- 2. FoodTemplateId FK on FoodEntry
IF COL_LENGTH('app.FoodEntry', 'FoodTemplateId') IS NULL
BEGIN
    ALTER TABLE app.FoodEntry
        ADD FoodTemplateId bigint NULL
            CONSTRAINT FK_FoodEntry_FoodTemplate FOREIGN KEY
            REFERENCES app.FoodTemplate(FoodTemplateId) ON DELETE SET NULL;
END;

-- 3. FavoriteRoutine table (P3)
IF OBJECT_ID('app.FavoriteRoutine', 'U') IS NULL
BEGIN
    CREATE TABLE app.FavoriteRoutine (
        FavoriteRoutineId bigint         IDENTITY(1,1) NOT NULL,
        UserId            bigint         NOT NULL,
        RoutineName       nvarchar(150)  NOT NULL,
        SortOrder         int            NOT NULL CONSTRAINT DF_FavoriteRoutine_SortOrder DEFAULT 0,
        IsActive          bit            NOT NULL CONSTRAINT DF_FavoriteRoutine_IsActive  DEFAULT 1,
        CreatedAtUtc      datetime2(0)   NOT NULL CONSTRAINT DF_FavoriteRoutine_CreatedAtUtc DEFAULT SYSUTCDATETIME(),
        UpdatedAtUtc      datetime2(0)   NOT NULL CONSTRAINT DF_FavoriteRoutine_UpdatedAtUtc DEFAULT SYSUTCDATETIME(),
        RowVersion        rowversion     NOT NULL,
        CONSTRAINT PK_FavoriteRoutine PRIMARY KEY (FavoriteRoutineId),
        CONSTRAINT FK_FavoriteRoutine_User FOREIGN KEY (UserId)
            REFERENCES app.[User](UserId)
    );
    CREATE INDEX IX_FavoriteRoutine_UserId ON app.FavoriteRoutine (UserId, IsActive);
END;

-- 4. FavoriteRoutineItem table (P3)
IF OBJECT_ID('app.FavoriteRoutineItem', 'U') IS NULL
BEGIN
    CREATE TABLE app.FavoriteRoutineItem (
        FavoriteRoutineItemId bigint       IDENTITY(1,1) NOT NULL,
        FavoriteRoutineId     bigint       NOT NULL,
        ItemType              varchar(10)  NOT NULL,   -- 'activity' | 'food'
        ActivityTemplateId    bigint       NULL,
        FoodTemplateId        bigint       NULL,
        SortOrder             int          NOT NULL CONSTRAINT DF_FavoriteRoutineItem_SortOrder DEFAULT 0,
        CONSTRAINT PK_FavoriteRoutineItem PRIMARY KEY (FavoriteRoutineItemId),
        CONSTRAINT FK_FavoriteRoutineItem_Routine FOREIGN KEY (FavoriteRoutineId)
            REFERENCES app.FavoriteRoutine(FavoriteRoutineId) ON DELETE CASCADE,
        CONSTRAINT FK_FavoriteRoutineItem_Activity FOREIGN KEY (ActivityTemplateId)
            REFERENCES app.ActivityTemplate(ActivityTemplateId) ON DELETE SET NULL,
        CONSTRAINT FK_FavoriteRoutineItem_Food FOREIGN KEY (FoodTemplateId)
            REFERENCES app.FoodTemplate(FoodTemplateId) ON DELETE SET NULL,
        CONSTRAINT CK_FavoriteRoutineItem_ItemType CHECK (ItemType IN ('activity', 'food'))
    );
END;
