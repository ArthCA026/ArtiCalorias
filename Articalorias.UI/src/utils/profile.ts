import type { UserProfileRequest, UserProfileResponse } from '@/types';

/** Maps a loaded profile response back to a save request, preserving all fields. */
export function profileToRequest(p: UserProfileResponse): UserProfileRequest {
  return {
    currentWeightKg: p.currentWeightKg,
    heightCm: p.heightCm,
    age: p.age,
    biologicalSex: p.biologicalSex,
    bmrKcal: p.bmrKcal,
    bodyFatPercent: p.bodyFatPercent,
    autoCalculateBMR: p.autoCalculateBMR,
    autoCalculateBodyFat: p.autoCalculateBodyFat,
    dailyBaseGoalKcal: p.dailyBaseGoalKcal,
    proteinGoalGrams: p.proteinGoalGrams,
    autoCalculateProteinGoal: p.autoCalculateProteinGoal,
    country: p.country,
    calorieDisplayMode: p.calorieDisplayMode,
    minCaloriesSafeguardEnabled: p.minCaloriesSafeguardEnabled,
    sleepHours: p.sleepHours,
    neatHours: p.neatHours,
  };
}
