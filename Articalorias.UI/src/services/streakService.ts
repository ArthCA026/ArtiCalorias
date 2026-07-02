import api from './api';
import type { StreakDto, UpdateStreakSettingsRequest } from '@/types/streak';

export const streakService = {
  getStreak() {
    return api.get<StreakDto>('/streak');
  },

  updateSettings(request: UpdateStreakSettingsRequest) {
    return api.put<StreakDto>('/streak/settings', request);
  },

  resetStreak() {
    return api.post<StreakDto>('/streak/reset');
  },
};
