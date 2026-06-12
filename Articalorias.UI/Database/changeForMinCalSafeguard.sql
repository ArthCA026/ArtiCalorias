ALTER TABLE [app].[UserProfile]
ADD [MinCaloriesSafeguardEnabled] BIT NOT NULL
    CONSTRAINT [DF_UserProfile_MinCaloriesSafeguardEnabled] DEFAULT 1;
