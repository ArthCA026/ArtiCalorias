import api from './api';
import type { AuthResponse, ChangePasswordRequest } from '@/types';

export const userService = {
  /**
   * Marks the user as actively present (keeps template auto-add alive).
   * Sent when the app becomes visible, never from background refetches.
   */
  heartbeat(): Promise<void> {
    return api.post('/user/heartbeat');
  },

  /**
   * Destructive actions re-check the password server-side: a bearer token
   * alone is not enough to erase anything.
   */
  clearHistory(password: string): Promise<void> {
    return api.delete('/user/history', { data: { password } });
  },

  deleteAccount(password: string): Promise<void> {
    return api.delete('/user/account', { data: { password } });
  },

  /** Other sessions are signed out; the returned tokens keep this one alive. */
  changePassword(data: ChangePasswordRequest) {
    return api.post<AuthResponse>('/user/change-password', data);
  },

  /** Art. 7 access right: everything the account holds, as one JSON object. */
  exportData() {
    return api.get<unknown>('/user/export');
  },
};
