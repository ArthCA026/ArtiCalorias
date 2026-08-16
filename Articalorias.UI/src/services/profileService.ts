import api from './api';
import type { UserProfileResponse, UserProfileRequest } from '@/types';

/** IANA timezone of this device, e.g. "America/Costa_Rica". */
function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

export const profileService = {
  get() {
    return api.get<UserProfileResponse>('/userprofile');
  },

  update(data: UserProfileRequest) {
    // Every save re-stamps the device timezone so the server can resolve the
    // user's local "today" (streaks, reminders, routine quick-add fallback).
    // Stamped here, at the single choke point, so no caller can forget it.
    return api.put<UserProfileResponse>('/userprofile', {
      ...data,
      timeZoneId: deviceTimeZone(),
    });
  },

  /** Marks the first-run tutorial as completed or skipped (idempotent). */
  markTutorialSeen() {
    return api.post('/userprofile/tutorial-seen');
  },
};
