export interface UserProfileResponse {
  userProfileId: number;
  currentWeightKg: number | null;
  heightCm: number | null;
  age: number | null;
  biologicalSex: string | null;
  bmrKcal: number;
  bodyFatPercent: number | null;
  autoCalculateBMR: boolean;
  autoCalculateBodyFat: boolean;
  dailyBaseGoalKcal: number;
  /** Optional "reach X by DATE" goal behind dailyBaseGoalKcal. */
  goalTargetWeightKg: number | null;
  goalTargetBodyFatPercent: number | null;
  /** yyyy-MM-dd */
  goalTargetDate: string | null;
  country: string | null;
  isOnboardingCompleted: boolean;
  /** The user finished or skipped the first-run tutorial. */
  hasSeenTutorial: boolean;
  /** The user has logged food themself at least once, ever. */
  hasEverLoggedFood: boolean;
  calorieDisplayMode: 'net' | 'goal' | 'adjusted';
  minCaloriesSafeguardEnabled: boolean;
  // Sleep & NEAT
  sleepHours: number;
  neatHours: number;
}

export interface UserProfileRequest {
  currentWeightKg: number | null;
  heightCm: number | null;
  /** IANA timezone id; stamped automatically by profileService.update. */
  timeZoneId?: string | null;
  age?: number | null;
  biologicalSex?: string | null;
  bmrKcal?: number | null;
  bodyFatPercent?: number | null;
  autoCalculateBMR: boolean;
  autoCalculateBodyFat: boolean;
  dailyBaseGoalKcal?: number | null;
  /** Optional "reach X by DATE" goal behind dailyBaseGoalKcal. */
  goalTargetWeightKg?: number | null;
  goalTargetBodyFatPercent?: number | null;
  /** yyyy-MM-dd */
  goalTargetDate?: string | null;
  country?: string | null;
  calorieDisplayMode: 'net' | 'goal' | 'adjusted';
  minCaloriesSafeguardEnabled: boolean;
  // Sleep & NEAT
  sleepHours: number;
  neatHours: number;
}
