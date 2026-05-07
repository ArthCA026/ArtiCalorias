import api from './api';
import type { DailyLogResponse } from '@/types/dailyLog';
import type { WeeklySummaryResponse } from '@/types/history';

export const historyService = {
  getDailyRange(from: string, to: string) {
    return api.get<DailyLogResponse[]>('/history/daily', { params: { from, to } });
  },

  getWeeklyRange(from: string, to: string) {
    return api.get<WeeklySummaryResponse[]>('/history/weekly', { params: { from, to } });
  },

  getWeekly(weekStartDate: string) {
    return api.get<WeeklySummaryResponse>(`/history/weekly/${weekStartDate}`);
  },
};
