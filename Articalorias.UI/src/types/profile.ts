export interface UserProfileResponse {
  userProfileId: number;
  currentWeightKg: number;
  heightCm: number;
  age: number | null;
  biologicalSex: string | null;
  bmrKcal: number;
  bodyFatPercent: number | null;
  autoCalculateBMR: boolean;
  autoCalculateBodyFat: boolean;
  dailyBaseGoalKcal: number;
  proteinGoalGrams: number | null;
  autoCalculateProteinGoal: boolean;
  country: string | null;
  isOnboardingCompleted: boolean;
}

export interface UserProfileRequest {
  currentWeightKg: number;
  heightCm: number;
  age?: number | null;
  biologicalSex?: string | null;
  bmrKcal?: number | null;
  bodyFatPercent?: number | null;
  autoCalculateBMR: boolean;
  autoCalculateBodyFat: boolean;
  dailyBaseGoalKcal?: number | null;
  proteinGoalGrams?: number | null;
  autoCalculateProteinGoal: boolean;
  country?: string | null;
}
