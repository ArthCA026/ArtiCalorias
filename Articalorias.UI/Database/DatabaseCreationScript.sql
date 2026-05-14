USE [master]
GO
/****** Object:  Database [Articalorias]    Script Date: 5/13/2026 3:33:49 PM ******/
CREATE DATABASE [Articalorias]
 CONTAINMENT = NONE
 ON  PRIMARY 
( NAME = N'Articalorias', FILENAME = N'C:\Program Files\Microsoft SQL Server\MSSQL17.SQLEXPRESS\MSSQL\DATA\Articalorias.mdf' , SIZE = 8192KB , MAXSIZE = UNLIMITED, FILEGROWTH = 65536KB )
 LOG ON 
( NAME = N'Articalorias_log', FILENAME = N'C:\Program Files\Microsoft SQL Server\MSSQL17.SQLEXPRESS\MSSQL\DATA\Articalorias_log.ldf' , SIZE = 8192KB , MAXSIZE = 2048GB , FILEGROWTH = 65536KB )
 WITH CATALOG_COLLATION = DATABASE_DEFAULT, LEDGER = OFF
GO
ALTER DATABASE [Articalorias] SET COMPATIBILITY_LEVEL = 170
GO
IF (1 = FULLTEXTSERVICEPROPERTY('IsFullTextInstalled'))
begin
EXEC [Articalorias].[dbo].[sp_fulltext_database] @action = 'enable'
end
GO
ALTER DATABASE [Articalorias] SET ANSI_NULL_DEFAULT OFF 
GO
ALTER DATABASE [Articalorias] SET ANSI_NULLS OFF 
GO
ALTER DATABASE [Articalorias] SET ANSI_PADDING OFF 
GO
ALTER DATABASE [Articalorias] SET ANSI_WARNINGS OFF 
GO
ALTER DATABASE [Articalorias] SET ARITHABORT OFF 
GO
ALTER DATABASE [Articalorias] SET AUTO_CLOSE OFF 
GO
ALTER DATABASE [Articalorias] SET AUTO_SHRINK OFF 
GO
ALTER DATABASE [Articalorias] SET AUTO_UPDATE_STATISTICS ON 
GO
ALTER DATABASE [Articalorias] SET CURSOR_CLOSE_ON_COMMIT OFF 
GO
ALTER DATABASE [Articalorias] SET CURSOR_DEFAULT  GLOBAL 
GO
ALTER DATABASE [Articalorias] SET CONCAT_NULL_YIELDS_NULL OFF 
GO
ALTER DATABASE [Articalorias] SET NUMERIC_ROUNDABORT OFF 
GO
ALTER DATABASE [Articalorias] SET QUOTED_IDENTIFIER OFF 
GO
ALTER DATABASE [Articalorias] SET RECURSIVE_TRIGGERS OFF 
GO
ALTER DATABASE [Articalorias] SET  DISABLE_BROKER 
GO
ALTER DATABASE [Articalorias] SET AUTO_UPDATE_STATISTICS_ASYNC OFF 
GO
ALTER DATABASE [Articalorias] SET DATE_CORRELATION_OPTIMIZATION OFF 
GO
ALTER DATABASE [Articalorias] SET TRUSTWORTHY OFF 
GO
ALTER DATABASE [Articalorias] SET ALLOW_SNAPSHOT_ISOLATION OFF 
GO
ALTER DATABASE [Articalorias] SET PARAMETERIZATION SIMPLE 
GO
ALTER DATABASE [Articalorias] SET READ_COMMITTED_SNAPSHOT OFF 
GO
ALTER DATABASE [Articalorias] SET HONOR_BROKER_PRIORITY OFF 
GO
ALTER DATABASE [Articalorias] SET RECOVERY SIMPLE 
GO
ALTER DATABASE [Articalorias] SET  MULTI_USER 
GO
ALTER DATABASE [Articalorias] SET PAGE_VERIFY CHECKSUM  
GO
ALTER DATABASE [Articalorias] SET DB_CHAINING OFF 
GO
ALTER DATABASE [Articalorias] SET FILESTREAM( NON_TRANSACTED_ACCESS = OFF ) 
GO
ALTER DATABASE [Articalorias] SET TARGET_RECOVERY_TIME = 60 SECONDS 
GO
ALTER DATABASE [Articalorias] SET DELAYED_DURABILITY = DISABLED 
GO
ALTER DATABASE [Articalorias] SET OPTIMIZED_LOCKING = OFF 
GO
ALTER DATABASE [Articalorias] SET ACCELERATED_DATABASE_RECOVERY = OFF  
GO
ALTER DATABASE [Articalorias] SET QUERY_STORE = ON
GO
ALTER DATABASE [Articalorias] SET QUERY_STORE (OPERATION_MODE = READ_WRITE, CLEANUP_POLICY = (STALE_QUERY_THRESHOLD_DAYS = 30), DATA_FLUSH_INTERVAL_SECONDS = 900, INTERVAL_LENGTH_MINUTES = 60, MAX_STORAGE_SIZE_MB = 1000, QUERY_CAPTURE_MODE = AUTO, SIZE_BASED_CLEANUP_MODE = AUTO, MAX_PLANS_PER_QUERY = 200, WAIT_STATS_CAPTURE_MODE = ON)
GO
USE [Articalorias]
GO
/****** Object:  Schema [admin]    Script Date: 5/13/2026 3:33:49 PM ******/
CREATE SCHEMA [admin]
GO
/****** Object:  Schema [app]    Script Date: 5/13/2026 3:33:49 PM ******/
CREATE SCHEMA [app]
GO
/****** Object:  Table [app].[ActivityEntry]    Script Date: 5/13/2026 3:33:49 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [app].[ActivityEntry](
	[ActivityEntryId] [bigint] IDENTITY(1,1) NOT NULL,
	[DailyLogId] [bigint] NOT NULL,
	[ActivityTemplateId] [bigint] NULL,
	[ActivityName] [nvarchar](150) NOT NULL,
	[DurationMinutes] [decimal](10, 2) NULL,
	[METValue] [decimal](8, 3) NULL,
	[CalculatedCaloriesKcal] [decimal](10, 2) NOT NULL,
	[SortOrder] [int] NOT NULL,
	[CreatedAtUtc] [datetime2](0) NOT NULL,
	[UpdatedAtUtc] [datetime2](0) NOT NULL,
	[RowVersion] [timestamp] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ActivityEntryId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [app].[ActivityTemplate]    Script Date: 5/13/2026 3:33:49 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [app].[ActivityTemplate](
	[ActivityTemplateId] [bigint] IDENTITY(1,1) NOT NULL,
	[UserId] [bigint] NULL,
	[TemplateScope] [varchar](20) NOT NULL,
	[TemplateName] [nvarchar](150) NOT NULL,
	[AutoAddToNewDay] [bit] NOT NULL,
	[IsActive] [bit] NOT NULL,
	[DefaultDurationMinutes] [decimal](10, 2) NULL,
	[DefaultMET] [decimal](8, 3) NULL,
	[CreatedAtUtc] [datetime2](0) NOT NULL,
	[UpdatedAtUtc] [datetime2](0) NOT NULL,
	[RowVersion] [timestamp] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[ActivityTemplateId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [app].[DailyLog]    Script Date: 5/13/2026 3:33:49 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [app].[DailyLog](
	[DailyLogId] [bigint] IDENTITY(1,1) NOT NULL,
	[UserId] [bigint] NOT NULL,
	[LogDate] [date] NOT NULL,
	[SnapshotWeightKg] [decimal](8, 2) NOT NULL,
	[SnapshotHeightCm] [decimal](8, 2) NOT NULL,
	[SnapshotBMRKcal] [decimal](10, 2) NOT NULL,
	[SnapshotBodyFatPercent] [decimal](5, 2) NULL,
	[SnapshotDailyBaseGoalKcal] [decimal](10, 2) NOT NULL,
	[SnapshotProteinGoalGrams] [decimal](10, 2) NOT NULL,
	[TotalFoodCaloriesKcal] [decimal](10, 2) NOT NULL,
	[TotalProteinGrams] [decimal](10, 2) NOT NULL,
	[TotalFatGrams] [decimal](10, 2) NOT NULL,
	[TotalCarbsGrams] [decimal](10, 2) NOT NULL,
	[TotalAlcoholGrams] [decimal](10, 2) NOT NULL,
	[TotalActivityCaloriesKcal] [decimal](10, 2) NOT NULL,
	[TEFKcal] [decimal](10, 2) NOT NULL,
	[HoursRemainingInDay] [decimal](6, 2) NOT NULL,
	[TotalDailyExpenditureKcal] [decimal](10, 2) NOT NULL,
	[NetBalanceKcal] [decimal](10, 2) NOT NULL,
	[DailyGoalDeltaKcal] [decimal](10, 2) NOT NULL,
	[CaloriesRemainingToDailyTargetKcal] [decimal](10, 2) NOT NULL,
	[ProteinRemainingGrams] [decimal](10, 2) NOT NULL,
	[WeekStartDate] [date] NOT NULL,
	[WeekEndDate] [date] NOT NULL,
	[WeeklyTargetKcal] [decimal](10, 2) NOT NULL,
	[WeeklyActualToDateKcal] [decimal](10, 2) NOT NULL,
	[WeeklyExpectedToDateKcal] [decimal](10, 2) NOT NULL,
	[WeeklyDifferenceKcal] [decimal](10, 2) NOT NULL,
	[WeeklyRemainingTargetKcal] [decimal](10, 2) NOT NULL,
	[SuggestedDailyAverageRemainingKcal] [decimal](10, 2) NOT NULL,
	[LastRecalculatedAtUtc] [datetime2](0) NULL,
	[CreatedAtUtc] [datetime2](0) NOT NULL,
	[UpdatedAtUtc] [datetime2](0) NOT NULL,
	[RowVersion] [timestamp] NOT NULL,
	[IdleTimeCaloriesKcal] [decimal](10, 2) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[DailyLogId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_DailyLog_User_LogDate] UNIQUE NONCLUSTERED 
(
	[UserId] ASC,
	[LogDate] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [app].[FoodEntry]    Script Date: 5/13/2026 3:33:49 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [app].[FoodEntry](
	[FoodEntryId] [bigint] IDENTITY(1,1) NOT NULL,
	[DailyLogId] [bigint] NOT NULL,
	[FoodName] [nvarchar](200) NOT NULL,
	[PortionDescription] [nvarchar](150) NULL,
	[Quantity] [decimal](10, 3) NULL,
	[Unit] [nvarchar](50) NULL,
	[CaloriesKcal] [decimal](10, 2) NOT NULL,
	[ProteinGrams] [decimal](10, 2) NOT NULL,
	[FatGrams] [decimal](10, 2) NOT NULL,
	[CarbsGrams] [decimal](10, 2) NOT NULL,
	[AlcoholGrams] [decimal](10, 2) NOT NULL,
	[SourceType] [varchar](20) NOT NULL,
	[SortOrder] [int] NOT NULL,
	[Notes] [nvarchar](500) NULL,
	[CreatedAtUtc] [datetime2](0) NOT NULL,
	[UpdatedAtUtc] [datetime2](0) NOT NULL,
	[RowVersion] [timestamp] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[FoodEntryId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [app].[MonthlySummary]    Script Date: 5/13/2026 3:33:49 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [app].[MonthlySummary](
	[MonthlySummaryId] [bigint] IDENTITY(1,1) NOT NULL,
	[UserId] [bigint] NOT NULL,
	[YearNumber] [int] NOT NULL,
	[MonthNumber] [int] NOT NULL,
	[MonthStartDate] [date] NOT NULL,
	[MonthEndDate] [date] NOT NULL,
	[TotalActivityCaloriesKcal] [decimal](14, 2) NOT NULL,
	[TotalTEFKcal] [decimal](14, 2) NOT NULL,
	[TotalExpenditureKcal] [decimal](14, 2) NOT NULL,
	[ActualMonthlyBalanceKcal] [decimal](14, 2) NOT NULL,
	[AverageDailyFoodCaloriesKcal] [decimal](10, 2) NOT NULL,
	[AverageDailyExpenditureKcal] [decimal](10, 2) NOT NULL,
	[AverageDailyBalanceKcal] [decimal](10, 2) NOT NULL,
	[AverageWeeklyBalanceKcal] [decimal](12, 2) NOT NULL,
	[EstimatedWeightChangeKg] [decimal](10, 4) NULL,
	[DaysLogged] [int] NOT NULL,
	[LastCalculatedAtUtc] [datetime2](0) NOT NULL,
	[CreatedAtUtc] [datetime2](0) NOT NULL,
	[UpdatedAtUtc] [datetime2](0) NOT NULL,
	[RowVersion] [timestamp] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[MonthlySummaryId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_MonthlySummary_User_Year_Month] UNIQUE NONCLUSTERED 
(
	[UserId] ASC,
	[YearNumber] ASC,
	[MonthNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [app].[User]    Script Date: 5/13/2026 3:33:49 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [app].[User](
	[UserId] [bigint] IDENTITY(1,1) NOT NULL,
	[Username] [nvarchar](100) NOT NULL,
	[Email] [nvarchar](255) NOT NULL,
	[PasswordHash] [nvarchar](500) NOT NULL,
	[PasswordSalt] [nvarchar](250) NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAtUtc] [datetime2](0) NOT NULL,
	[UpdatedAtUtc] [datetime2](0) NOT NULL,
	[RowVersion] [timestamp] NOT NULL,
	[PasswordResetToken] [nvarchar](250) NULL,
	[PasswordResetTokenExpiresAtUtc] [datetime2](0) NULL,
PRIMARY KEY CLUSTERED 
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_User_Email] UNIQUE NONCLUSTERED 
(
	[Email] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_User_Username] UNIQUE NONCLUSTERED 
(
	[Username] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [app].[UserProfile]    Script Date: 5/13/2026 3:33:49 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [app].[UserProfile](
	[UserProfileId] [bigint] IDENTITY(1,1) NOT NULL,
	[UserId] [bigint] NOT NULL,
	[CurrentWeightKg] [decimal](8, 2) NOT NULL,
	[HeightCm] [decimal](8, 2) NOT NULL,
	[BMRKcal] [decimal](10, 2) NOT NULL,
	[BodyFatPercent] [decimal](5, 2) NULL,
	[DailyBaseGoalKcal] [decimal](10, 2) NOT NULL,
	[ProteinGoalGrams] [decimal](10, 2) NULL,
	[AutoCalculateProteinGoal] [bit] NOT NULL,
	[IsOnboardingCompleted] [bit] NOT NULL,
	[CreatedAtUtc] [datetime2](0) NOT NULL,
	[UpdatedAtUtc] [datetime2](0) NOT NULL,
	[RowVersion] [timestamp] NOT NULL,
	[Age] [int] NULL,
	[BiologicalSex] [nvarchar](1) NULL,
	[AutoCalculateBMR] [bit] NOT NULL,
	[AutoCalculateBodyFat] [bit] NOT NULL,
	[Country] [nvarchar](100) NULL,
PRIMARY KEY CLUSTERED 
(
	[UserProfileId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_UserProfile_User] UNIQUE NONCLUSTERED 
(
	[UserId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PushSubscriptions]    Script Date: 5/13/2026 3:33:49 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PushSubscriptions](
	[PushSubscriptionId] [bigint] IDENTITY(1,1) NOT NULL,
	[UserId] [bigint] NOT NULL,
	[Endpoint] [nvarchar](2048) NOT NULL,
	[P256DH] [nvarchar](512) NOT NULL,
	[Auth] [nvarchar](256) NOT NULL,
	[CreatedAtUtc] [datetime2](7) NOT NULL,
 CONSTRAINT [PK_PushSubscriptions] PRIMARY KEY CLUSTERED 
(
	[PushSubscriptionId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Index [IX_ActivityEntry_DailyLogId]    Script Date: 5/13/2026 3:33:49 PM ******/
CREATE NONCLUSTERED INDEX [IX_ActivityEntry_DailyLogId] ON [app].[ActivityEntry]
(
	[DailyLogId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_ActivityTemplate_UserId]    Script Date: 5/13/2026 3:33:49 PM ******/
CREATE NONCLUSTERED INDEX [IX_ActivityTemplate_UserId] ON [app].[ActivityTemplate]
(
	[UserId] ASC,
	[IsActive] ASC,
	[TemplateName] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_DailyLog_User_LogDate]    Script Date: 5/13/2026 3:33:49 PM ******/
CREATE NONCLUSTERED INDEX [IX_DailyLog_User_LogDate] ON [app].[DailyLog]
(
	[UserId] ASC,
	[LogDate] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_DailyLog_User_WeekStartDate]    Script Date: 5/13/2026 3:33:49 PM ******/
CREATE NONCLUSTERED INDEX [IX_DailyLog_User_WeekStartDate] ON [app].[DailyLog]
(
	[UserId] ASC,
	[WeekStartDate] ASC,
	[LogDate] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_FoodEntry_DailyLogId]    Script Date: 5/13/2026 3:33:49 PM ******/
CREATE NONCLUSTERED INDEX [IX_FoodEntry_DailyLogId] ON [app].[FoodEntry]
(
	[DailyLogId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
/****** Object:  Index [IX_MonthlySummary_User_Year_Month]    Script Date: 5/13/2026 3:33:49 PM ******/
CREATE NONCLUSTERED INDEX [IX_MonthlySummary_User_Year_Month] ON [app].[MonthlySummary]
(
	[UserId] ASC,
	[YearNumber] ASC,
	[MonthNumber] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_PushSubscriptions_Endpoint]    Script Date: 5/13/2026 3:33:49 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [IX_PushSubscriptions_Endpoint] ON [dbo].[PushSubscriptions]
(
	[Endpoint] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [app].[ActivityEntry] ADD  CONSTRAINT [DF_ActivityEntry_CalculatedCalories]  DEFAULT ((0)) FOR [CalculatedCaloriesKcal]
GO
ALTER TABLE [app].[ActivityEntry] ADD  CONSTRAINT [DF_ActivityEntry_SortOrder]  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [app].[ActivityEntry] ADD  CONSTRAINT [DF_ActivityEntry_CreatedAtUtc]  DEFAULT (sysutcdatetime()) FOR [CreatedAtUtc]
GO
ALTER TABLE [app].[ActivityEntry] ADD  CONSTRAINT [DF_ActivityEntry_UpdatedAtUtc]  DEFAULT (sysutcdatetime()) FOR [UpdatedAtUtc]
GO
ALTER TABLE [app].[ActivityTemplate] ADD  CONSTRAINT [DF_ActivityTemplate_AutoAdd]  DEFAULT ((0)) FOR [AutoAddToNewDay]
GO
ALTER TABLE [app].[ActivityTemplate] ADD  CONSTRAINT [DF_ActivityTemplate_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [app].[ActivityTemplate] ADD  CONSTRAINT [DF_ActivityTemplate_CreatedAtUtc]  DEFAULT (sysutcdatetime()) FOR [CreatedAtUtc]
GO
ALTER TABLE [app].[ActivityTemplate] ADD  CONSTRAINT [DF_ActivityTemplate_UpdatedAtUtc]  DEFAULT (sysutcdatetime()) FOR [UpdatedAtUtc]
GO
ALTER TABLE [app].[DailyLog] ADD  CONSTRAINT [DF_DailyLog_TotalFoodCalories]  DEFAULT ((0)) FOR [TotalFoodCaloriesKcal]
GO
ALTER TABLE [app].[DailyLog] ADD  CONSTRAINT [DF_DailyLog_TotalProtein]  DEFAULT ((0)) FOR [TotalProteinGrams]
GO
ALTER TABLE [app].[DailyLog] ADD  CONSTRAINT [DF_DailyLog_TotalFat]  DEFAULT ((0)) FOR [TotalFatGrams]
GO
ALTER TABLE [app].[DailyLog] ADD  CONSTRAINT [DF_DailyLog_TotalCarbs]  DEFAULT ((0)) FOR [TotalCarbsGrams]
GO
ALTER TABLE [app].[DailyLog] ADD  CONSTRAINT [DF_DailyLog_TotalAlcohol]  DEFAULT ((0)) FOR [TotalAlcoholGrams]
GO
ALTER TABLE [app].[DailyLog] ADD  CONSTRAINT [DF_DailyLog_TotalActivityCalories]  DEFAULT ((0)) FOR [TotalActivityCaloriesKcal]
GO
ALTER TABLE [app].[DailyLog] ADD  CONSTRAINT [DF_DailyLog_TEF]  DEFAULT ((0)) FOR [TEFKcal]
GO
ALTER TABLE [app].[DailyLog] ADD  CONSTRAINT [DF_DailyLog_HoursRemaining]  DEFAULT ((0)) FOR [HoursRemainingInDay]
GO
ALTER TABLE [app].[DailyLog] ADD  CONSTRAINT [DF_DailyLog_TotalDailyExpenditure]  DEFAULT ((0)) FOR [TotalDailyExpenditureKcal]
GO
ALTER TABLE [app].[DailyLog] ADD  CONSTRAINT [DF_DailyLog_NetBalance]  DEFAULT ((0)) FOR [NetBalanceKcal]
GO
ALTER TABLE [app].[DailyLog] ADD  CONSTRAINT [DF_DailyLog_DailyGoalDelta]  DEFAULT ((0)) FOR [DailyGoalDeltaKcal]
GO
ALTER TABLE [app].[DailyLog] ADD  CONSTRAINT [DF_DailyLog_CalRemaining]  DEFAULT ((0)) FOR [CaloriesRemainingToDailyTargetKcal]
GO
ALTER TABLE [app].[DailyLog] ADD  CONSTRAINT [DF_DailyLog_ProteinRemaining]  DEFAULT ((0)) FOR [ProteinRemainingGrams]
GO
ALTER TABLE [app].[DailyLog] ADD  CONSTRAINT [DF_DailyLog_WeeklyTarget]  DEFAULT ((0)) FOR [WeeklyTargetKcal]
GO
ALTER TABLE [app].[DailyLog] ADD  CONSTRAINT [DF_DailyLog_WeeklyActualToDate]  DEFAULT ((0)) FOR [WeeklyActualToDateKcal]
GO
ALTER TABLE [app].[DailyLog] ADD  CONSTRAINT [DF_DailyLog_WeeklyExpectedToDate]  DEFAULT ((0)) FOR [WeeklyExpectedToDateKcal]
GO
ALTER TABLE [app].[DailyLog] ADD  CONSTRAINT [DF_DailyLog_WeeklyDifference]  DEFAULT ((0)) FOR [WeeklyDifferenceKcal]
GO
ALTER TABLE [app].[DailyLog] ADD  CONSTRAINT [DF_DailyLog_WeeklyRemainingTarget]  DEFAULT ((0)) FOR [WeeklyRemainingTargetKcal]
GO
ALTER TABLE [app].[DailyLog] ADD  CONSTRAINT [DF_DailyLog_SuggestedDailyAverage]  DEFAULT ((0)) FOR [SuggestedDailyAverageRemainingKcal]
GO
ALTER TABLE [app].[DailyLog] ADD  CONSTRAINT [DF_DailyLog_CreatedAtUtc]  DEFAULT (sysutcdatetime()) FOR [CreatedAtUtc]
GO
ALTER TABLE [app].[DailyLog] ADD  CONSTRAINT [DF_DailyLog_UpdatedAtUtc]  DEFAULT (sysutcdatetime()) FOR [UpdatedAtUtc]
GO
ALTER TABLE [app].[DailyLog] ADD  CONSTRAINT [DF_DailyLog_IdleTimeCalories]  DEFAULT ((0)) FOR [IdleTimeCaloriesKcal]
GO
ALTER TABLE [app].[FoodEntry] ADD  CONSTRAINT [DF_FoodEntry_Calories]  DEFAULT ((0)) FOR [CaloriesKcal]
GO
ALTER TABLE [app].[FoodEntry] ADD  CONSTRAINT [DF_FoodEntry_Protein]  DEFAULT ((0)) FOR [ProteinGrams]
GO
ALTER TABLE [app].[FoodEntry] ADD  CONSTRAINT [DF_FoodEntry_Fat]  DEFAULT ((0)) FOR [FatGrams]
GO
ALTER TABLE [app].[FoodEntry] ADD  CONSTRAINT [DF_FoodEntry_Carbs]  DEFAULT ((0)) FOR [CarbsGrams]
GO
ALTER TABLE [app].[FoodEntry] ADD  CONSTRAINT [DF_FoodEntry_Alcohol]  DEFAULT ((0)) FOR [AlcoholGrams]
GO
ALTER TABLE [app].[FoodEntry] ADD  CONSTRAINT [DF_FoodEntry_SortOrder]  DEFAULT ((0)) FOR [SortOrder]
GO
ALTER TABLE [app].[FoodEntry] ADD  CONSTRAINT [DF_FoodEntry_CreatedAtUtc]  DEFAULT (sysutcdatetime()) FOR [CreatedAtUtc]
GO
ALTER TABLE [app].[FoodEntry] ADD  CONSTRAINT [DF_FoodEntry_UpdatedAtUtc]  DEFAULT (sysutcdatetime()) FOR [UpdatedAtUtc]
GO
ALTER TABLE [app].[MonthlySummary] ADD  CONSTRAINT [DF_MonthlySummary_TotalActivity]  DEFAULT ((0)) FOR [TotalActivityCaloriesKcal]
GO
ALTER TABLE [app].[MonthlySummary] ADD  CONSTRAINT [DF_MonthlySummary_TotalTEF]  DEFAULT ((0)) FOR [TotalTEFKcal]
GO
ALTER TABLE [app].[MonthlySummary] ADD  CONSTRAINT [DF_MonthlySummary_TotalExpenditure]  DEFAULT ((0)) FOR [TotalExpenditureKcal]
GO
ALTER TABLE [app].[MonthlySummary] ADD  CONSTRAINT [DF_MonthlySummary_ActualBalance]  DEFAULT ((0)) FOR [ActualMonthlyBalanceKcal]
GO
ALTER TABLE [app].[MonthlySummary] ADD  CONSTRAINT [DF_MonthlySummary_AvgFood]  DEFAULT ((0)) FOR [AverageDailyFoodCaloriesKcal]
GO
ALTER TABLE [app].[MonthlySummary] ADD  CONSTRAINT [DF_MonthlySummary_AvgExpenditure]  DEFAULT ((0)) FOR [AverageDailyExpenditureKcal]
GO
ALTER TABLE [app].[MonthlySummary] ADD  CONSTRAINT [DF_MonthlySummary_AvgBalance]  DEFAULT ((0)) FOR [AverageDailyBalanceKcal]
GO
ALTER TABLE [app].[MonthlySummary] ADD  CONSTRAINT [DF_MonthlySummary_AvgWeeklyBalance]  DEFAULT ((0)) FOR [AverageWeeklyBalanceKcal]
GO
ALTER TABLE [app].[MonthlySummary] ADD  CONSTRAINT [DF_MonthlySummary_DaysLogged]  DEFAULT ((0)) FOR [DaysLogged]
GO
ALTER TABLE [app].[MonthlySummary] ADD  CONSTRAINT [DF_MonthlySummary_LastCalculatedAt]  DEFAULT (sysutcdatetime()) FOR [LastCalculatedAtUtc]
GO
ALTER TABLE [app].[MonthlySummary] ADD  CONSTRAINT [DF_MonthlySummary_CreatedAt]  DEFAULT (sysutcdatetime()) FOR [CreatedAtUtc]
GO
ALTER TABLE [app].[MonthlySummary] ADD  CONSTRAINT [DF_MonthlySummary_UpdatedAt]  DEFAULT (sysutcdatetime()) FOR [UpdatedAtUtc]
GO
ALTER TABLE [app].[User] ADD  CONSTRAINT [DF_User_IsActive]  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [app].[User] ADD  CONSTRAINT [DF_User_CreatedAtUtc]  DEFAULT (sysutcdatetime()) FOR [CreatedAtUtc]
GO
ALTER TABLE [app].[User] ADD  CONSTRAINT [DF_User_UpdatedAtUtc]  DEFAULT (sysutcdatetime()) FOR [UpdatedAtUtc]
GO
ALTER TABLE [app].[UserProfile] ADD  CONSTRAINT [DF_UserProfile_DailyBaseGoalKcal]  DEFAULT ((-500)) FOR [DailyBaseGoalKcal]
GO
ALTER TABLE [app].[UserProfile] ADD  CONSTRAINT [DF_UserProfile_AutoProtein]  DEFAULT ((1)) FOR [AutoCalculateProteinGoal]
GO
ALTER TABLE [app].[UserProfile] ADD  CONSTRAINT [DF_UserProfile_OnboardingCompleted]  DEFAULT ((0)) FOR [IsOnboardingCompleted]
GO
ALTER TABLE [app].[UserProfile] ADD  CONSTRAINT [DF_UserProfile_CreatedAtUtc]  DEFAULT (sysutcdatetime()) FOR [CreatedAtUtc]
GO
ALTER TABLE [app].[UserProfile] ADD  CONSTRAINT [DF_UserProfile_UpdatedAtUtc]  DEFAULT (sysutcdatetime()) FOR [UpdatedAtUtc]
GO
ALTER TABLE [app].[UserProfile] ADD  CONSTRAINT [DF_UserProfile_AutoCalculateBMR]  DEFAULT ((0)) FOR [AutoCalculateBMR]
GO
ALTER TABLE [app].[UserProfile] ADD  CONSTRAINT [DF_UserProfile_AutoCalculateBodyFat]  DEFAULT ((0)) FOR [AutoCalculateBodyFat]
GO
ALTER TABLE [dbo].[PushSubscriptions] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAtUtc]
GO
ALTER TABLE [app].[ActivityEntry]  WITH CHECK ADD  CONSTRAINT [FK_ActivityEntry_DailyLog] FOREIGN KEY([DailyLogId])
REFERENCES [app].[DailyLog] ([DailyLogId])
ON DELETE CASCADE
GO
ALTER TABLE [app].[ActivityEntry] CHECK CONSTRAINT [FK_ActivityEntry_DailyLog]
GO
ALTER TABLE [app].[ActivityEntry]  WITH CHECK ADD  CONSTRAINT [FK_ActivityEntry_Template] FOREIGN KEY([ActivityTemplateId])
REFERENCES [app].[ActivityTemplate] ([ActivityTemplateId])
GO
ALTER TABLE [app].[ActivityEntry] CHECK CONSTRAINT [FK_ActivityEntry_Template]
GO
ALTER TABLE [app].[ActivityTemplate]  WITH CHECK ADD  CONSTRAINT [FK_ActivityTemplate_User] FOREIGN KEY([UserId])
REFERENCES [app].[User] ([UserId])
GO
ALTER TABLE [app].[ActivityTemplate] CHECK CONSTRAINT [FK_ActivityTemplate_User]
GO
ALTER TABLE [app].[DailyLog]  WITH CHECK ADD  CONSTRAINT [FK_DailyLog_User] FOREIGN KEY([UserId])
REFERENCES [app].[User] ([UserId])
GO
ALTER TABLE [app].[DailyLog] CHECK CONSTRAINT [FK_DailyLog_User]
GO
ALTER TABLE [app].[FoodEntry]  WITH CHECK ADD  CONSTRAINT [FK_FoodEntry_DailyLog] FOREIGN KEY([DailyLogId])
REFERENCES [app].[DailyLog] ([DailyLogId])
ON DELETE CASCADE
GO
ALTER TABLE [app].[FoodEntry] CHECK CONSTRAINT [FK_FoodEntry_DailyLog]
GO
ALTER TABLE [app].[MonthlySummary]  WITH CHECK ADD  CONSTRAINT [FK_MonthlySummary_User] FOREIGN KEY([UserId])
REFERENCES [app].[User] ([UserId])
GO
ALTER TABLE [app].[MonthlySummary] CHECK CONSTRAINT [FK_MonthlySummary_User]
GO
ALTER TABLE [app].[UserProfile]  WITH CHECK ADD  CONSTRAINT [FK_UserProfile_User] FOREIGN KEY([UserId])
REFERENCES [app].[User] ([UserId])
GO
ALTER TABLE [app].[UserProfile] CHECK CONSTRAINT [FK_UserProfile_User]
GO
ALTER TABLE [dbo].[PushSubscriptions]  WITH CHECK ADD  CONSTRAINT [FK_PushSubscriptions_Users_UserId] FOREIGN KEY([UserId])
REFERENCES [app].[User] ([UserId])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[PushSubscriptions] CHECK CONSTRAINT [FK_PushSubscriptions_Users_UserId]
GO
ALTER TABLE [app].[ActivityTemplate]  WITH CHECK ADD  CONSTRAINT [CK_ActivityTemplate_TemplateScope] CHECK  (([TemplateScope]='USER' OR [TemplateScope]='SYSTEM'))
GO
ALTER TABLE [app].[ActivityTemplate] CHECK CONSTRAINT [CK_ActivityTemplate_TemplateScope]
GO
ALTER TABLE [app].[ActivityTemplate]  WITH CHECK ADD  CONSTRAINT [CK_ActivityTemplate_UserScope] CHECK  (([TemplateScope]='SYSTEM' AND [UserId] IS NULL OR [TemplateScope]='USER' AND [UserId] IS NOT NULL))
GO
ALTER TABLE [app].[ActivityTemplate] CHECK CONSTRAINT [CK_ActivityTemplate_UserScope]
GO
ALTER TABLE [app].[DailyLog]  WITH CHECK ADD  CONSTRAINT [CK_DailyLog_SnapshotBMR] CHECK  (([SnapshotBMRKcal]>(0)))
GO
ALTER TABLE [app].[DailyLog] CHECK CONSTRAINT [CK_DailyLog_SnapshotBMR]
GO
ALTER TABLE [app].[DailyLog]  WITH CHECK ADD  CONSTRAINT [CK_DailyLog_SnapshotHeight] CHECK  (([SnapshotHeightCm]>(0)))
GO
ALTER TABLE [app].[DailyLog] CHECK CONSTRAINT [CK_DailyLog_SnapshotHeight]
GO
ALTER TABLE [app].[DailyLog]  WITH CHECK ADD  CONSTRAINT [CK_DailyLog_SnapshotWeight] CHECK  (([SnapshotWeightKg]>(0)))
GO
ALTER TABLE [app].[DailyLog] CHECK CONSTRAINT [CK_DailyLog_SnapshotWeight]
GO
ALTER TABLE [app].[DailyLog]  WITH CHECK ADD  CONSTRAINT [CK_DailyLog_WeekRange] CHECK  (([WeekEndDate]>=[WeekStartDate]))
GO
ALTER TABLE [app].[DailyLog] CHECK CONSTRAINT [CK_DailyLog_WeekRange]
GO
ALTER TABLE [app].[FoodEntry]  WITH CHECK ADD  CONSTRAINT [CK_FoodEntry_SourceType] CHECK  (([SourceType]='MIXED' OR [SourceType]='MANUAL' OR [SourceType]='AI_IMAGE' OR [SourceType]='AI'))
GO
ALTER TABLE [app].[FoodEntry] CHECK CONSTRAINT [CK_FoodEntry_SourceType]
GO
ALTER TABLE [app].[MonthlySummary]  WITH CHECK ADD  CONSTRAINT [CK_MonthlySummary_Month] CHECK  (([MonthNumber]>=(1) AND [MonthNumber]<=(12)))
GO
ALTER TABLE [app].[MonthlySummary] CHECK CONSTRAINT [CK_MonthlySummary_Month]
GO
ALTER TABLE [app].[MonthlySummary]  WITH CHECK ADD  CONSTRAINT [CK_MonthlySummary_MonthRange] CHECK  (([MonthEndDate]>=[MonthStartDate]))
GO
ALTER TABLE [app].[MonthlySummary] CHECK CONSTRAINT [CK_MonthlySummary_MonthRange]
GO
ALTER TABLE [app].[UserProfile]  WITH CHECK ADD  CONSTRAINT [CK_UserProfile_BMRKcal] CHECK  (([BMRKcal]>(0)))
GO
ALTER TABLE [app].[UserProfile] CHECK CONSTRAINT [CK_UserProfile_BMRKcal]
GO
ALTER TABLE [app].[UserProfile]  WITH CHECK ADD  CONSTRAINT [CK_UserProfile_BodyFatPercent] CHECK  (([BodyFatPercent] IS NULL OR [BodyFatPercent]>=(0) AND [BodyFatPercent]<=(100)))
GO
ALTER TABLE [app].[UserProfile] CHECK CONSTRAINT [CK_UserProfile_BodyFatPercent]
GO
ALTER TABLE [app].[UserProfile]  WITH CHECK ADD  CONSTRAINT [CK_UserProfile_CurrentWeightKg] CHECK  (([CurrentWeightKg]>(0)))
GO
ALTER TABLE [app].[UserProfile] CHECK CONSTRAINT [CK_UserProfile_CurrentWeightKg]
GO
ALTER TABLE [app].[UserProfile]  WITH CHECK ADD  CONSTRAINT [CK_UserProfile_HeightCm] CHECK  (([HeightCm]>(0)))
GO
ALTER TABLE [app].[UserProfile] CHECK CONSTRAINT [CK_UserProfile_HeightCm]
GO
/****** Object:  StoredProcedure [admin].[DeleteUser]    Script Date: 5/13/2026 3:33:49 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- Create the stored procedure for cascading user deletion
CREATE   PROCEDURE [admin].[DeleteUser]
    @UserId BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @ErrorMessage NVARCHAR(4000);
    DECLARE @RowsAffected INT = 0;
    
    -- Validate that user exists
    IF NOT EXISTS (SELECT 1 FROM [app].[User] WHERE UserId = @UserId)
    BEGIN
        RAISERROR('User with UserId %d does not exist.', 16, 1, @UserId);
        RETURN -1;
    END
    
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Delete from child tables of DailyLog first
        DELETE FROM [app].[ActivityEntry] 
        WHERE DailyLogId IN (SELECT DailyLogId FROM [app].[DailyLog] WHERE UserId = @UserId);
        
        DELETE FROM [app].[FoodEntry] 
        WHERE DailyLogId IN (SELECT DailyLogId FROM [app].[DailyLog] WHERE UserId = @UserId);
        
        -- Delete from direct child tables of User
        DELETE FROM [app].[ActivityTemplate] WHERE UserId = @UserId;
        DELETE FROM [app].[DailyLog] WHERE UserId = @UserId;
        DELETE FROM [app].[MonthlySummary] WHERE UserId = @UserId;
        DELETE FROM [app].[UserProfile] WHERE UserId = @UserId;
        DELETE FROM [app].[WeeklySummary] WHERE UserId = @UserId;
        
        -- Finally delete the user
        DELETE FROM [app].[User] WHERE UserId = @UserId;
        SET @RowsAffected = @@ROWCOUNT;
        
        COMMIT TRANSACTION;
        
        PRINT 'User ' + CAST(@UserId AS NVARCHAR(20)) + ' and all related records deleted successfully.';
        RETURN 0;
        
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        
        SET @ErrorMessage = ERROR_MESSAGE();
        RAISERROR('Error deleting user: %s', 16, 1, @ErrorMessage);
        RETURN -1;
    END CATCH
END

GO
USE [master]
GO
ALTER DATABASE [Articalorias] SET  READ_WRITE 
GO
