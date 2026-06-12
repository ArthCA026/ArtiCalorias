import api from './api';

export const userService = {
  clearHistory(): Promise<void> {
    return api.delete('/user/history');
  },

  deleteAccount(): Promise<void> {
    return api.delete('/user/account');
  },
};
