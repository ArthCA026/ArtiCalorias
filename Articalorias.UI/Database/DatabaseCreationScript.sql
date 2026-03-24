/*
===========================================================
 SCHEMA
===========================================================
*/
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'app')
BEGIN
    EXEC('CREATE SCHEMA app');
END
GO

/*
===========================================================
 1. USERS
===========================================================
*/
CREATE TABLE app.[User]
(
    UserId               BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Username             NVARCHAR(100) NOT NULL,
    Email                NVARCHAR(255) NOT NULL,
    PasswordHash         NVARCHAR(500) NOT NULL,
    PasswordSalt         NVARCHAR(250) NULL,
    IsActive             BIT NOT NULL CONSTRAINT DF_User_IsActive DEFAULT (1),
    PasswordResetToken   NVARCHAR(250) NULL,
    PasswordResetTokenExpiresAtUtc DATETIME2(0) NULL,
    CreatedAtUtc         DATETIME2(0) NOT NULL CONSTRAINT DF_User_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    UpdatedAtUtc         DATETIME2(0) NOT NULL CONSTRAINT DF_User_UpdatedAtUtc DEFAULT (SYSUTCDATETIME()),
    RowVersion           ROWVERSION NOT NULL,

    CONSTRAINT UQ_User_Username UNIQUE (Username),
    CONSTRAINT UQ_User_Email UNIQUE (Email)
);
GO

/*
===========================================================
 2. USER PROFILE
   Perfil vigente del usuario.
   DailyLog guardará snapshots para no romper el histórico.
===========================================================
*/
CREATE TABLE app.UserProfile
(
    UserProfileId                    BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserId                           BIGINT NOT NULL,
    
    -- Datos fisiológicos vigentes
    CurrentWeightKg                  DECIMAL(8,2) NOT NULL,
    HeightCm                         DECIMAL(8,2) NOT NULL,
    Age                              INT NULL,
    BiologicalSex                    NVARCHAR(1) NULL,
    BMRKcal                          DECIMAL(10,2) NOT NULL,        -- TMB
    BodyFatPercent                   DECIMAL(5,2) NULL,
    AutoCalculateBMR                 BIT NOT NULL CONSTRAINT DF_UserProfile_AutoCalcBMR DEFAULT (0),
    AutoCalculateBodyFat             BIT NOT NULL CONSTRAINT DF_UserProfile_AutoCalcBodyFat DEFAULT (0),

    -- Metas vigentes
    DailyBaseGoalKcal                DECIMAL(10,2) NOT NULL CONSTRAINT DF_UserProfile_DailyBaseGoalKcal DEFAULT (-500),
    ProteinGoalGrams                 DECIMAL(10,2) NULL,            -- si es null, backend puede calcularla
    AutoCalculateProteinGoal         BIT NOT NULL CONSTRAINT DF_UserProfile_AutoProtein DEFAULT (1),

    Country                          NVARCHAR(100) NULL,

    IsOnboardingCompleted            BIT NOT NULL CONSTRAINT DF_UserProfile_OnboardingCompleted DEFAULT (0),
    CreatedAtUtc                     DATETIME2(0) NOT NULL CONSTRAINT DF_UserProfile_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    UpdatedAtUtc                     DATETIME2(0) NOT NULL CONSTRAINT DF_UserProfile_UpdatedAtUtc DEFAULT (SYSUTCDATETIME()),
    RowVersion                       ROWVERSION NOT NULL,

    CONSTRAINT FK_UserProfile_User FOREIGN KEY (UserId)
        REFERENCES app.[User](UserId),

    CONSTRAINT UQ_UserProfile_User UNIQUE (UserId),

    CONSTRAINT CK_UserProfile_CurrentWeightKg CHECK (CurrentWeightKg > 0),
    CONSTRAINT CK_UserProfile_HeightCm CHECK (HeightCm > 0),
    CONSTRAINT CK_UserProfile_BMRKcal CHECK (BMRKcal > 0),
    CONSTRAINT CK_UserProfile_BodyFatPercent CHECK (BodyFatPercent IS NULL OR (BodyFatPercent >= 0 AND BodyFatPercent <= 100))
);
GO

/*
===========================================================
 3. DAILY LOG
   Contenedor del día.
   Guarda snapshots y totales ya calculados.
===========================================================
*/
CREATE TABLE app.DailyLog
(
    DailyLogId                              BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserId                                  BIGINT NOT NULL,
    LogDate                                 DATE NOT NULL,

    -- Snapshot del perfil usado ese día
    SnapshotWeightKg                        DECIMAL(8,2) NOT NULL,
    SnapshotHeightCm                        DECIMAL(8,2) NOT NULL,
    SnapshotBMRKcal                         DECIMAL(10,2) NOT NULL,
    SnapshotBodyFatPercent                  DECIMAL(5,2) NULL,
    SnapshotDailyBaseGoalKcal               DECIMAL(10,2) NOT NULL,
    SnapshotProteinGoalGrams                DECIMAL(10,2) NOT NULL,

    -- Ingesta total del día
    TotalFoodCaloriesKcal                   DECIMAL(10,2) NOT NULL CONSTRAINT DF_DailyLog_TotalFoodCalories DEFAULT (0),
    TotalProteinGrams                       DECIMAL(10,2) NOT NULL CONSTRAINT DF_DailyLog_TotalProtein DEFAULT (0),
    TotalFatGrams                           DECIMAL(10,2) NOT NULL CONSTRAINT DF_DailyLog_TotalFat DEFAULT (0),
    TotalCarbsGrams                         DECIMAL(10,2) NOT NULL CONSTRAINT DF_DailyLog_TotalCarbs DEFAULT (0),
    TotalAlcoholGrams                       DECIMAL(10,2) NOT NULL CONSTRAINT DF_DailyLog_TotalAlcohol DEFAULT (0),

    -- Gasto del día
    TotalActivityCaloriesKcal               DECIMAL(10,2) NOT NULL CONSTRAINT DF_DailyLog_TotalActivityCalories DEFAULT (0),
    TEFKcal                                 DECIMAL(10,2) NOT NULL CONSTRAINT DF_DailyLog_TEF DEFAULT (0),
    HoursRemainingInDay                     DECIMAL(6,2) NOT NULL CONSTRAINT DF_DailyLog_HoursRemaining DEFAULT (0),
    IdleTimeCaloriesKcal                    DECIMAL(10,2) NOT NULL CONSTRAINT DF_DailyLog_IdleTimeCalories DEFAULT (0),
    TotalDailyExpenditureKcal               DECIMAL(10,2) NOT NULL CONSTRAINT DF_DailyLog_TotalDailyExpenditure DEFAULT (0),

    -- Balance / objetivos
    NetBalanceKcal                          DECIMAL(10,2) NOT NULL CONSTRAINT DF_DailyLog_NetBalance DEFAULT (0),
    DailyGoalDeltaKcal                      DECIMAL(10,2) NOT NULL CONSTRAINT DF_DailyLog_DailyGoalDelta DEFAULT (0),
    CaloriesRemainingToDailyTargetKcal      DECIMAL(10,2) NOT NULL CONSTRAINT DF_DailyLog_CalRemaining DEFAULT (0),
    ProteinRemainingGrams                   DECIMAL(10,2) NOT NULL CONSTRAINT DF_DailyLog_ProteinRemaining DEFAULT (0),

    -- Contexto semanal visible en pantalla principal
    WeekStartDate                           DATE NOT NULL,
    WeekEndDate                             DATE NOT NULL,
    WeeklyTargetKcal                        DECIMAL(10,2) NOT NULL CONSTRAINT DF_DailyLog_WeeklyTarget DEFAULT (0),
    WeeklyActualToDateKcal                  DECIMAL(10,2) NOT NULL CONSTRAINT DF_DailyLog_WeeklyActualToDate DEFAULT (0),
    WeeklyExpectedToDateKcal                DECIMAL(10,2) NOT NULL CONSTRAINT DF_DailyLog_WeeklyExpectedToDate DEFAULT (0),
    WeeklyDifferenceKcal                    DECIMAL(10,2) NOT NULL CONSTRAINT DF_DailyLog_WeeklyDifference DEFAULT (0),
    WeeklyRemainingTargetKcal               DECIMAL(10,2) NOT NULL CONSTRAINT DF_DailyLog_WeeklyRemainingTarget DEFAULT (0),
    SuggestedDailyAverageRemainingKcal      DECIMAL(10,2) NOT NULL CONSTRAINT DF_DailyLog_SuggestedDailyAverage DEFAULT (0),

    -- Estado
    IsFinalized                             BIT NOT NULL CONSTRAINT DF_DailyLog_IsFinalized DEFAULT (0),
    LastRecalculatedAtUtc                   DATETIME2(0) NULL,
    CreatedAtUtc                            DATETIME2(0) NOT NULL CONSTRAINT DF_DailyLog_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    UpdatedAtUtc                            DATETIME2(0) NOT NULL CONSTRAINT DF_DailyLog_UpdatedAtUtc DEFAULT (SYSUTCDATETIME()),
    RowVersion                              ROWVERSION NOT NULL,

    CONSTRAINT FK_DailyLog_User FOREIGN KEY (UserId)
        REFERENCES app.[User](UserId),

    CONSTRAINT UQ_DailyLog_User_LogDate UNIQUE (UserId, LogDate),

    CONSTRAINT CK_DailyLog_WeekRange CHECK (WeekEndDate >= WeekStartDate),
    CONSTRAINT CK_DailyLog_SnapshotWeight CHECK (SnapshotWeightKg > 0),
    CONSTRAINT CK_DailyLog_SnapshotHeight CHECK (SnapshotHeightCm > 0),
    CONSTRAINT CK_DailyLog_SnapshotBMR CHECK (SnapshotBMRKcal > 0)
);
GO

CREATE INDEX IX_DailyLog_User_WeekStartDate
    ON app.DailyLog(UserId, WeekStartDate, LogDate);
GO

CREATE INDEX IX_DailyLog_User_LogDate
    ON app.DailyLog(UserId, LogDate);
GO

/*
===========================================================
 4. FOOD ENTRY
   Registro estructurado final de cada alimento o línea de comida.
   No guarda el texto libre original.
===========================================================
*/
CREATE TABLE app.FoodEntry
(
    FoodEntryId                    BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    DailyLogId                     BIGINT NOT NULL,

    FoodName                       NVARCHAR(200) NOT NULL,
    PortionDescription             NVARCHAR(150) NULL,     -- ej: "3 unidades", "50 g", "1/2 porción"
    Quantity                       DECIMAL(10,3) NULL,
    Unit                           NVARCHAR(50) NULL,      -- g, ml, unidad, porcion, etc.

    CaloriesKcal                   DECIMAL(10,2) NOT NULL CONSTRAINT DF_FoodEntry_Calories DEFAULT (0),
    ProteinGrams                   DECIMAL(10,2) NOT NULL CONSTRAINT DF_FoodEntry_Protein DEFAULT (0),
    FatGrams                       DECIMAL(10,2) NOT NULL CONSTRAINT DF_FoodEntry_Fat DEFAULT (0),
    CarbsGrams                     DECIMAL(10,2) NOT NULL CONSTRAINT DF_FoodEntry_Carbs DEFAULT (0),
    AlcoholGrams                   DECIMAL(10,2) NOT NULL CONSTRAINT DF_FoodEntry_Alcohol DEFAULT (0),

    SourceType                     VARCHAR(20) NOT NULL,   -- AI, MANUAL, MIXED
    SortOrder                      INT NOT NULL CONSTRAINT DF_FoodEntry_SortOrder DEFAULT (0),
    Notes                          NVARCHAR(500) NULL,

    CreatedAtUtc                   DATETIME2(0) NOT NULL CONSTRAINT DF_FoodEntry_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    UpdatedAtUtc                   DATETIME2(0) NOT NULL CONSTRAINT DF_FoodEntry_UpdatedAtUtc DEFAULT (SYSUTCDATETIME()),
    RowVersion                     ROWVERSION NOT NULL,

    CONSTRAINT FK_FoodEntry_DailyLog FOREIGN KEY (DailyLogId)
        REFERENCES app.DailyLog(DailyLogId)
        ON DELETE CASCADE,

    CONSTRAINT CK_FoodEntry_SourceType CHECK (SourceType IN ('AI', 'MANUAL', 'MIXED'))
);
GO

CREATE INDEX IX_FoodEntry_DailyLogId
    ON app.FoodEntry(DailyLogId);
GO

/*
===========================================================
 5. ACTIVITY TEMPLATE
   Catálogo unificado:
   - system recommended
   - user common
===========================================================
*/
CREATE TABLE app.ActivityTemplate
(
    ActivityTemplateId             BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserId                         BIGINT NULL,               -- NULL = plantilla global/recomendada por sistema
    TemplateScope                  VARCHAR(20) NOT NULL,      -- SYSTEM, USER
    ActivityType                   VARCHAR(20) NOT NULL,      -- MET_SIMPLE, MET_MULTIPLE, DIRECT_CALORIES

    TemplateName                   NVARCHAR(150) NOT NULL,
    Description                    NVARCHAR(500) NULL,

    -- Para plantillas frecuentes del usuario
    AutoAddToNewDay                BIT NOT NULL CONSTRAINT DF_ActivityTemplate_AutoAdd DEFAULT (0),
    IsActive                       BIT NOT NULL CONSTRAINT DF_ActivityTemplate_IsActive DEFAULT (1),

    -- Defaults opcionales
    DefaultDurationMinutes         DECIMAL(10,2) NULL,
    DefaultDirectCaloriesKcal      DECIMAL(10,2) NULL,
    DefaultMET                     DECIMAL(8,3) NULL,

    CreatedAtUtc                   DATETIME2(0) NOT NULL CONSTRAINT DF_ActivityTemplate_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    UpdatedAtUtc                   DATETIME2(0) NOT NULL CONSTRAINT DF_ActivityTemplate_UpdatedAtUtc DEFAULT (SYSUTCDATETIME()),
    RowVersion                     ROWVERSION NOT NULL,

    CONSTRAINT FK_ActivityTemplate_User FOREIGN KEY (UserId)
        REFERENCES app.[User](UserId),

    CONSTRAINT CK_ActivityTemplate_TemplateScope CHECK (TemplateScope IN ('SYSTEM', 'USER')),
    CONSTRAINT CK_ActivityTemplate_ActivityType CHECK (ActivityType IN ('MET_SIMPLE', 'MET_MULTIPLE', 'DIRECT_CALORIES')),
    CONSTRAINT CK_ActivityTemplate_UserScope CHECK (
        (TemplateScope = 'SYSTEM' AND UserId IS NULL)
        OR
        (TemplateScope = 'USER' AND UserId IS NOT NULL)
    )
);
GO

CREATE INDEX IX_ActivityTemplate_UserId
    ON app.ActivityTemplate(UserId, IsActive, TemplateName);
GO

/*
===========================================================
 6. ACTIVITY TEMPLATE SEGMENT
   Para plantillas de MET múltiple.
   También puede usarse en MET simple con un solo segmento si se desea.
===========================================================
*/
CREATE TABLE app.ActivityTemplateSegment
(
    ActivityTemplateSegmentId      BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    ActivityTemplateId             BIGINT NOT NULL,
    SegmentOrder                   INT NOT NULL,
    SegmentName                    NVARCHAR(100) NOT NULL,
    METValue                       DECIMAL(8,3) NOT NULL,
    DefaultDurationMinutes         DECIMAL(10,2) NOT NULL,

    CreatedAtUtc                   DATETIME2(0) NOT NULL CONSTRAINT DF_ActivityTemplateSegment_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT FK_ActivityTemplateSegment_Template FOREIGN KEY (ActivityTemplateId)
        REFERENCES app.ActivityTemplate(ActivityTemplateId)
        ON DELETE CASCADE,

    CONSTRAINT UQ_ActivityTemplateSegment_Order UNIQUE (ActivityTemplateId, SegmentOrder),
    CONSTRAINT CK_ActivityTemplateSegment_MET CHECK (METValue > 0),
    CONSTRAINT CK_ActivityTemplateSegment_Duration CHECK (DefaultDurationMinutes >= 0)
);
GO

/*
===========================================================
 7. ACTIVITY ENTRY
   Registro concreto de actividad de un día.
===========================================================
*/
CREATE TABLE app.ActivityEntry
(
    ActivityEntryId                BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    DailyLogId                     BIGINT NOT NULL,
    ActivityTemplateId             BIGINT NULL,

    ActivityType                   VARCHAR(20) NOT NULL,      -- MET_SIMPLE, MET_MULTIPLE, DIRECT_CALORIES
    ActivityName                   NVARCHAR(150) NOT NULL,

    DurationMinutes                DECIMAL(10,2) NULL,        -- útil para MET simple o direct calories si se desea guardar
    DirectCaloriesKcal             DECIMAL(10,2) NULL,        -- para DIRECT_CALORIES
    METValue                       DECIMAL(8,3) NULL,         -- para MET_SIMPLE

    CalculatedCaloriesKcal         DECIMAL(10,2) NOT NULL CONSTRAINT DF_ActivityEntry_CalculatedCalories DEFAULT (0),
    IsGlobalDefault                BIT NOT NULL CONSTRAINT DF_ActivityEntry_IsGlobalDefault DEFAULT (0),
    Notes                          NVARCHAR(500) NULL,
    SortOrder                      INT NOT NULL CONSTRAINT DF_ActivityEntry_SortOrder DEFAULT (0),

    CreatedAtUtc                   DATETIME2(0) NOT NULL CONSTRAINT DF_ActivityEntry_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),
    UpdatedAtUtc                   DATETIME2(0) NOT NULL CONSTRAINT DF_ActivityEntry_UpdatedAtUtc DEFAULT (SYSUTCDATETIME()),
    RowVersion                     ROWVERSION NOT NULL,

    CONSTRAINT FK_ActivityEntry_DailyLog FOREIGN KEY (DailyLogId)
        REFERENCES app.DailyLog(DailyLogId)
        ON DELETE CASCADE,

    CONSTRAINT FK_ActivityEntry_Template FOREIGN KEY (ActivityTemplateId)
        REFERENCES app.ActivityTemplate(ActivityTemplateId),

    CONSTRAINT CK_ActivityEntry_ActivityType CHECK (ActivityType IN ('MET_SIMPLE', 'MET_MULTIPLE', 'DIRECT_CALORIES'))
);
GO

CREATE INDEX IX_ActivityEntry_DailyLogId
    ON app.ActivityEntry(DailyLogId);
GO

/*
===========================================================
 8. ACTIVITY ENTRY SEGMENT
   Para actividades del día con varias fases.
   Ejemplo: patinaje con fase activa + fase descanso.
===========================================================
*/
CREATE TABLE app.ActivityEntrySegment
(
    ActivityEntrySegmentId         BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    ActivityEntryId                BIGINT NOT NULL,
    SegmentOrder                   INT NOT NULL,
    SegmentName                    NVARCHAR(100) NOT NULL,
    METValue                       DECIMAL(8,3) NOT NULL,
    DurationMinutes                DECIMAL(10,2) NOT NULL,
    CalculatedCaloriesKcal         DECIMAL(10,2) NOT NULL CONSTRAINT DF_ActivityEntrySegment_CalculatedCalories DEFAULT (0),

    CreatedAtUtc                   DATETIME2(0) NOT NULL CONSTRAINT DF_ActivityEntrySegment_CreatedAtUtc DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT FK_ActivityEntrySegment_ActivityEntry FOREIGN KEY (ActivityEntryId)
        REFERENCES app.ActivityEntry(ActivityEntryId)
        ON DELETE CASCADE,

    CONSTRAINT UQ_ActivityEntrySegment_Order UNIQUE (ActivityEntryId, SegmentOrder),
    CONSTRAINT CK_ActivityEntrySegment_MET CHECK (METValue > 0),
    CONSTRAINT CK_ActivityEntrySegment_Duration CHECK (DurationMinutes >= 0)
);
GO

/*
===========================================================
 9. WEEKLY SUMMARY
   Resumen persistido de la semana.
===========================================================
*/
CREATE TABLE app.WeeklySummary
(
    WeeklySummaryId                       BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserId                                BIGINT NOT NULL,
    WeekStartDate                         DATE NOT NULL,
    WeekEndDate                           DATE NOT NULL,

    BaseDailyGoalKcalUsed                 DECIMAL(10,2) NOT NULL,
    ExpectedWeeklyTargetKcal              DECIMAL(10,2) NOT NULL,

    TotalFoodCaloriesKcal                 DECIMAL(12,2) NOT NULL CONSTRAINT DF_WeeklySummary_TotalFood DEFAULT (0),
    TotalProteinGrams                     DECIMAL(12,2) NOT NULL CONSTRAINT DF_WeeklySummary_TotalProtein DEFAULT (0),
    TotalFatGrams                         DECIMAL(12,2) NOT NULL CONSTRAINT DF_WeeklySummary_TotalFat DEFAULT (0),
    TotalCarbsGrams                       DECIMAL(12,2) NOT NULL CONSTRAINT DF_WeeklySummary_TotalCarbs DEFAULT (0),
    TotalAlcoholGrams                     DECIMAL(12,2) NOT NULL CONSTRAINT DF_WeeklySummary_TotalAlcohol DEFAULT (0),

    TotalActivityCaloriesKcal             DECIMAL(12,2) NOT NULL CONSTRAINT DF_WeeklySummary_TotalActivity DEFAULT (0),
    TotalTEFKcal                          DECIMAL(12,2) NOT NULL CONSTRAINT DF_WeeklySummary_TotalTEF DEFAULT (0),
    TotalExpenditureKcal                  DECIMAL(12,2) NOT NULL CONSTRAINT DF_WeeklySummary_TotalExpenditure DEFAULT (0),

    ActualWeeklyBalanceKcal               DECIMAL(12,2) NOT NULL CONSTRAINT DF_WeeklySummary_ActualBalance DEFAULT (0),
    DifferenceVsTargetKcal                DECIMAL(12,2) NOT NULL CONSTRAINT DF_WeeklySummary_DifferenceVsTarget DEFAULT (0),
    RemainingTargetKcal                   DECIMAL(12,2) NOT NULL CONSTRAINT DF_WeeklySummary_RemainingTarget DEFAULT (0),
    RequiredDailyAverageRemainingKcal     DECIMAL(12,2) NOT NULL CONSTRAINT DF_WeeklySummary_RequiredAvg DEFAULT (0),

    DaysLogged                            INT NOT NULL CONSTRAINT DF_WeeklySummary_DaysLogged DEFAULT (0),
    EstimatedWeightChangeKg               DECIMAL(10,4) NULL,

    LastCalculatedAtUtc                   DATETIME2(0) NOT NULL CONSTRAINT DF_WeeklySummary_LastCalculatedAt DEFAULT (SYSUTCDATETIME()),
    CreatedAtUtc                          DATETIME2(0) NOT NULL CONSTRAINT DF_WeeklySummary_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAtUtc                          DATETIME2(0) NOT NULL CONSTRAINT DF_WeeklySummary_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    RowVersion                            ROWVERSION NOT NULL,

    CONSTRAINT FK_WeeklySummary_User FOREIGN KEY (UserId)
        REFERENCES app.[User](UserId),

    CONSTRAINT UQ_WeeklySummary_User_Week UNIQUE (UserId, WeekStartDate),
    CONSTRAINT CK_WeeklySummary_WeekRange CHECK (WeekEndDate >= WeekStartDate)
);
GO

CREATE INDEX IX_WeeklySummary_User_WeekStartDate
    ON app.WeeklySummary(UserId, WeekStartDate);
GO

/*
===========================================================
 10. MONTHLY SUMMARY
   Resumen persistido del mes.
===========================================================
*/
CREATE TABLE app.MonthlySummary
(
    MonthlySummaryId                      BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UserId                                BIGINT NOT NULL,
    YearNumber                            INT NOT NULL,
    MonthNumber                           INT NOT NULL, -- 1 a 12
    MonthStartDate                        DATE NOT NULL,
    MonthEndDate                          DATE NOT NULL,

    TotalFoodCaloriesKcal                 DECIMAL(14,2) NOT NULL CONSTRAINT DF_MonthlySummary_TotalFood DEFAULT (0),
    TotalProteinGrams                     DECIMAL(14,2) NOT NULL CONSTRAINT DF_MonthlySummary_TotalProtein DEFAULT (0),
    TotalFatGrams                         DECIMAL(14,2) NOT NULL CONSTRAINT DF_MonthlySummary_TotalFat DEFAULT (0),
    TotalCarbsGrams                       DECIMAL(14,2) NOT NULL CONSTRAINT DF_MonthlySummary_TotalCarbs DEFAULT (0),
    TotalAlcoholGrams                     DECIMAL(14,2) NOT NULL CONSTRAINT DF_MonthlySummary_TotalAlcohol DEFAULT (0),

    TotalActivityCaloriesKcal             DECIMAL(14,2) NOT NULL CONSTRAINT DF_MonthlySummary_TotalActivity DEFAULT (0),
    TotalTEFKcal                          DECIMAL(14,2) NOT NULL CONSTRAINT DF_MonthlySummary_TotalTEF DEFAULT (0),
    TotalExpenditureKcal                  DECIMAL(14,2) NOT NULL CONSTRAINT DF_MonthlySummary_TotalExpenditure DEFAULT (0),

    ActualMonthlyBalanceKcal              DECIMAL(14,2) NOT NULL CONSTRAINT DF_MonthlySummary_ActualBalance DEFAULT (0),

    AverageDailyFoodCaloriesKcal          DECIMAL(10,2) NOT NULL CONSTRAINT DF_MonthlySummary_AvgFood DEFAULT (0),
    AverageDailyExpenditureKcal           DECIMAL(10,2) NOT NULL CONSTRAINT DF_MonthlySummary_AvgExpenditure DEFAULT (0),
    AverageDailyBalanceKcal               DECIMAL(10,2) NOT NULL CONSTRAINT DF_MonthlySummary_AvgBalance DEFAULT (0),

    AverageWeeklyBalanceKcal              DECIMAL(12,2) NOT NULL CONSTRAINT DF_MonthlySummary_AvgWeeklyBalance DEFAULT (0),
    EstimatedWeightChangeKg               DECIMAL(10,4) NULL,
    DaysLogged                            INT NOT NULL CONSTRAINT DF_MonthlySummary_DaysLogged DEFAULT (0),

    LastCalculatedAtUtc                   DATETIME2(0) NOT NULL CONSTRAINT DF_MonthlySummary_LastCalculatedAt DEFAULT (SYSUTCDATETIME()),
    CreatedAtUtc                          DATETIME2(0) NOT NULL CONSTRAINT DF_MonthlySummary_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAtUtc                          DATETIME2(0) NOT NULL CONSTRAINT DF_MonthlySummary_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    RowVersion                            ROWVERSION NOT NULL,

    CONSTRAINT FK_MonthlySummary_User FOREIGN KEY (UserId)
        REFERENCES app.[User](UserId),

    CONSTRAINT UQ_MonthlySummary_User_Year_Month UNIQUE (UserId, YearNumber, MonthNumber),
    CONSTRAINT CK_MonthlySummary_Month CHECK (MonthNumber BETWEEN 1 AND 12),
    CONSTRAINT CK_MonthlySummary_MonthRange CHECK (MonthEndDate >= MonthStartDate)
);
GO

CREATE INDEX IX_MonthlySummary_User_Year_Month
    ON app.MonthlySummary(UserId, YearNumber, MonthNumber);
GO

/*
===========================================================
 Seed: Global default SYSTEM activity templates

 These templates are used by the application to auto-populate
 every new daily log with baseline activities for all users.

 1. Sleep      – MET 0.9,  default 360 min (6 hours)
 2. NEAT       – MET 3.0,  default 180 min (3 hours)
===========================================================
*/

-- 1. Sleep
IF NOT EXISTS (
    SELECT 1
    FROM app.ActivityTemplate
    WHERE TemplateScope = 'SYSTEM'
      AND TemplateName  = N'Sleep'
      AND IsActive      = 1
)
BEGIN
    INSERT INTO app.ActivityTemplate
    (
        UserId,
        TemplateScope,
        ActivityType,
        TemplateName,
        [Description],
        AutoAddToNewDay,
        IsActive,
        DefaultDurationMinutes,
        DefaultDirectCaloriesKcal,
        DefaultMET
    )
    VALUES
    (
        NULL,               -- SYSTEM template, no user
        'SYSTEM',
        'MET_SIMPLE',
        N'Sleep',
        N'Default sleep activity – MET 0.9, 6 hours',
        1,                  -- AutoAddToNewDay = true
        1,                  -- IsActive = true
        360.00,             -- 6 hours = 360 minutes
        NULL,
        0.900               -- MET value
    );
END
GO

-- 2. NEAT (Non-Exercise Activity Thermogenesis)
IF NOT EXISTS (
    SELECT 1
    FROM app.ActivityTemplate
    WHERE TemplateScope = 'SYSTEM'
      AND TemplateName  = N'NEAT'
      AND IsActive      = 1
)
BEGIN
    INSERT INTO app.ActivityTemplate
    (
        UserId,
        TemplateScope,
        ActivityType,
        TemplateName,
        [Description],
        AutoAddToNewDay,
        IsActive,
        DefaultDurationMinutes,
        DefaultDirectCaloriesKcal,
        DefaultMET
    )
    VALUES
    (
        NULL,               -- SYSTEM template, no user
        'SYSTEM',
        'MET_SIMPLE',
        N'NEAT',
        N'Non-Exercise Activity Thermogenesis (cooking, cleaning, bathing, etc.) – MET 3.0, 3 hours',
        1,                  -- AutoAddToNewDay = true
        1,                  -- IsActive = true
        180.00,             -- 3 hours = 180 minutes
        NULL,
        3.000               -- MET value
    );
END
GO

/*
===========================================================
 Seed: Predefined SYSTEM activity templates

 Provides a library of common activities available to all
 users. These templates have AutoAddToNewDay = 0 (users
 pick them manually) and can only be modified via direct
 database updates — never through the UI.
===========================================================
*/

-- 3. Active Ice Skating
IF NOT EXISTS (SELECT 1 FROM app.ActivityTemplate WHERE TemplateScope = 'SYSTEM' AND TemplateName = N'Active Ice Skating' AND IsActive = 1)
BEGIN
    INSERT INTO app.ActivityTemplate (UserId, TemplateScope, ActivityType, TemplateName, [Description], AutoAddToNewDay, IsActive, DefaultDurationMinutes, DefaultDirectCaloriesKcal, DefaultMET)
    VALUES (NULL, 'SYSTEM', 'MET_SIMPLE', N'Active Ice Skating', N'Recreational ice skating at moderate effort', 0, 1, 60.00, NULL, 5.500);
END
GO

-- 4. Weightlifting
IF NOT EXISTS (SELECT 1 FROM app.ActivityTemplate WHERE TemplateScope = 'SYSTEM' AND TemplateName = N'Weightlifting' AND IsActive = 1)
BEGIN
    INSERT INTO app.ActivityTemplate (UserId, TemplateScope, ActivityType, TemplateName, [Description], AutoAddToNewDay, IsActive, DefaultDurationMinutes, DefaultDirectCaloriesKcal, DefaultMET)
    VALUES (NULL, 'SYSTEM', 'MET_SIMPLE', N'Weightlifting', N'General weightlifting / resistance training', 0, 1, 60.00, NULL, 6.000);
END
GO

-- 5. Walking (moderate pace)
IF NOT EXISTS (SELECT 1 FROM app.ActivityTemplate WHERE TemplateScope = 'SYSTEM' AND TemplateName = N'Walking' AND IsActive = 1)
BEGIN
    INSERT INTO app.ActivityTemplate (UserId, TemplateScope, ActivityType, TemplateName, [Description], AutoAddToNewDay, IsActive, DefaultDurationMinutes, DefaultDirectCaloriesKcal, DefaultMET)
    VALUES (NULL, 'SYSTEM', 'MET_SIMPLE', N'Walking', N'Walking at moderate pace (~5 km/h)', 0, 1, 30.00, NULL, 3.500);
END
GO

-- 6. Running (moderate pace)
IF NOT EXISTS (SELECT 1 FROM app.ActivityTemplate WHERE TemplateScope = 'SYSTEM' AND TemplateName = N'Running' AND IsActive = 1)
BEGIN
    INSERT INTO app.ActivityTemplate (UserId, TemplateScope, ActivityType, TemplateName, [Description], AutoAddToNewDay, IsActive, DefaultDurationMinutes, DefaultDirectCaloriesKcal, DefaultMET)
    VALUES (NULL, 'SYSTEM', 'MET_SIMPLE', N'Running', N'Running at moderate pace (~8 km/h)', 0, 1, 30.00, NULL, 8.000);
END
GO

-- 7. Passive Stretching
IF NOT EXISTS (SELECT 1 FROM app.ActivityTemplate WHERE TemplateScope = 'SYSTEM' AND TemplateName = N'Passive Stretching' AND IsActive = 1)
BEGIN
    INSERT INTO app.ActivityTemplate (UserId, TemplateScope, ActivityType, TemplateName, [Description], AutoAddToNewDay, IsActive, DefaultDurationMinutes, DefaultDirectCaloriesKcal, DefaultMET)
    VALUES (NULL, 'SYSTEM', 'MET_SIMPLE', N'Passive Stretching', N'Gentle stretching / cool-down', 0, 1, 15.00, NULL, 2.300);
END
GO

-- 8. Driving
IF NOT EXISTS (SELECT 1 FROM app.ActivityTemplate WHERE TemplateScope = 'SYSTEM' AND TemplateName = N'Driving' AND IsActive = 1)
BEGIN
    INSERT INTO app.ActivityTemplate (UserId, TemplateScope, ActivityType, TemplateName, [Description], AutoAddToNewDay, IsActive, DefaultDurationMinutes, DefaultDirectCaloriesKcal, DefaultMET)
    VALUES (NULL, 'SYSTEM', 'MET_SIMPLE', N'Driving', N'Driving a car or light vehicle', 0, 1, 60.00, NULL, 2.000);
END
GO

-- 9. Desk Job
IF NOT EXISTS (SELECT 1 FROM app.ActivityTemplate WHERE TemplateScope = 'SYSTEM' AND TemplateName = N'Desk Job' AND IsActive = 1)
BEGIN
    INSERT INTO app.ActivityTemplate (UserId, TemplateScope, ActivityType, TemplateName, [Description], AutoAddToNewDay, IsActive, DefaultDurationMinutes, DefaultDirectCaloriesKcal, DefaultMET)
    VALUES (NULL, 'SYSTEM', 'MET_SIMPLE', N'Desk Job', N'Seated office/desk work', 0, 1, 480.00, NULL, 1.500);
END
GO

-- 10. Cycling (leisure)
IF NOT EXISTS (SELECT 1 FROM app.ActivityTemplate WHERE TemplateScope = 'SYSTEM' AND TemplateName = N'Cycling (leisure)' AND IsActive = 1)
BEGIN
    INSERT INTO app.ActivityTemplate (UserId, TemplateScope, ActivityType, TemplateName, [Description], AutoAddToNewDay, IsActive, DefaultDurationMinutes, DefaultDirectCaloriesKcal, DefaultMET)
    VALUES (NULL, 'SYSTEM', 'MET_SIMPLE', N'Cycling (leisure)', N'Leisure cycling at light effort', 0, 1, 30.00, NULL, 4.000);
END
GO

-- 11. Swimming (moderate)
IF NOT EXISTS (SELECT 1 FROM app.ActivityTemplate WHERE TemplateScope = 'SYSTEM' AND TemplateName = N'Swimming (moderate)' AND IsActive = 1)
BEGIN
    INSERT INTO app.ActivityTemplate (UserId, TemplateScope, ActivityType, TemplateName, [Description], AutoAddToNewDay, IsActive, DefaultDurationMinutes, DefaultDirectCaloriesKcal, DefaultMET)
    VALUES (NULL, 'SYSTEM', 'MET_SIMPLE', N'Swimming (moderate)', N'Swimming laps at moderate effort', 0, 1, 30.00, NULL, 6.000);
END
GO

-- 12. Yoga
IF NOT EXISTS (SELECT 1 FROM app.ActivityTemplate WHERE TemplateScope = 'SYSTEM' AND TemplateName = N'Yoga' AND IsActive = 1)
BEGIN
    INSERT INTO app.ActivityTemplate (UserId, TemplateScope, ActivityType, TemplateName, [Description], AutoAddToNewDay, IsActive, DefaultDurationMinutes, DefaultDirectCaloriesKcal, DefaultMET)
    VALUES (NULL, 'SYSTEM', 'MET_SIMPLE', N'Yoga', N'Hatha yoga – moderate poses', 0, 1, 60.00, NULL, 2.500);
END
GO

-- 13. HIIT
IF NOT EXISTS (SELECT 1 FROM app.ActivityTemplate WHERE TemplateScope = 'SYSTEM' AND TemplateName = N'HIIT' AND IsActive = 1)
BEGIN
    INSERT INTO app.ActivityTemplate (UserId, TemplateScope, ActivityType, TemplateName, [Description], AutoAddToNewDay, IsActive, DefaultDurationMinutes, DefaultDirectCaloriesKcal, DefaultMET)
    VALUES (NULL, 'SYSTEM', 'MET_SIMPLE', N'HIIT', N'High-Intensity Interval Training', 0, 1, 25.00, NULL, 8.000);
END
GO

-- 14. Dancing
IF NOT EXISTS (SELECT 1 FROM app.ActivityTemplate WHERE TemplateScope = 'SYSTEM' AND TemplateName = N'Dancing' AND IsActive = 1)
BEGIN
    INSERT INTO app.ActivityTemplate (UserId, TemplateScope, ActivityType, TemplateName, [Description], AutoAddToNewDay, IsActive, DefaultDurationMinutes, DefaultDirectCaloriesKcal, DefaultMET)
    VALUES (NULL, 'SYSTEM', 'MET_SIMPLE', N'Dancing', N'General dancing – moderate effort', 0, 1, 30.00, NULL, 4.500);
END
GO

-- 15. Gardening
IF NOT EXISTS (SELECT 1 FROM app.ActivityTemplate WHERE TemplateScope = 'SYSTEM' AND TemplateName = N'Gardening' AND IsActive = 1)
BEGIN
    INSERT INTO app.ActivityTemplate (UserId, TemplateScope, ActivityType, TemplateName, [Description], AutoAddToNewDay, IsActive, DefaultDurationMinutes, DefaultDirectCaloriesKcal, DefaultMET)
    VALUES (NULL, 'SYSTEM', 'MET_SIMPLE', N'Gardening', N'General gardening / yard work', 0, 1, 60.00, NULL, 3.500);
END
GO

-- 16. Climbing Stairs
IF NOT EXISTS (SELECT 1 FROM app.ActivityTemplate WHERE TemplateScope = 'SYSTEM' AND TemplateName = N'Climbing Stairs' AND IsActive = 1)
BEGIN
    INSERT INTO app.ActivityTemplate (UserId, TemplateScope, ActivityType, TemplateName, [Description], AutoAddToNewDay, IsActive, DefaultDurationMinutes, DefaultDirectCaloriesKcal, DefaultMET)
    VALUES (NULL, 'SYSTEM', 'MET_SIMPLE', N'Climbing Stairs', N'Stair climbing at moderate pace', 0, 1, 15.00, NULL, 4.000);
END
GO
