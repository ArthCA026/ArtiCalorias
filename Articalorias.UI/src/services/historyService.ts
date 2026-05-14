import api from './api';
import type { DailyLogResponse } from '@/types/dailyLog';

export const historyService = {
  getDailyRange(from: string, to: string) {
    return api.get<DailyLogResponse[]>('/history/daily', { params: { from, to } });
  },
};
