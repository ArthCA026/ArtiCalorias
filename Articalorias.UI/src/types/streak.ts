export interface StreakDto {
  streakEnabled: boolean;
  currentStreak: number;
  longestStreak: number;
  lastLoggedDate: string | null; // ISO date "YYYY-MM-DD"
}

export interface UpdateStreakSettingsRequest {
  streakEnabled: boolean;
}
