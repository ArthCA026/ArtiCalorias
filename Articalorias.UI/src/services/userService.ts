import api from './api';

export const userService = {
  /**
   * Marks the user as actively present (keeps template auto-add alive).
   * Sent when the app becomes visible, never from background refetches.
   */
  heartbeat(): Promise<void> {
    return api.post('/user/heartbeat');
  },

  clearHistory(): Promise<void> {
    return api.delete('/user/history');
  },

  deleteAccount(): Promise<void> {
    return api.delete('/user/account');
  },

  /** Art. 7 access right: everything the account holds, as one JSON object. */
  exportData() {
    return api.get<unknown>('/user/export');
  },
};
