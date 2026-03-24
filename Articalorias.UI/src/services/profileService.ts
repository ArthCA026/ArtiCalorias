import api from './api';
import type { UserProfileResponse, UserProfileRequest } from '@/types';

export const profileService = {
  get() {
    return api.get<UserProfileResponse>('/userprofile');
  },

  update(data: UserProfileRequest) {
    return api.put<UserProfileResponse>('/userprofile', data);
  },
};
