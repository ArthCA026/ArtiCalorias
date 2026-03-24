import api from './api';
import type { DailyLogResponse } from '@/types/dailyLog';
import type { WeeklySummaryResponse, MonthlySummaryResponse } from '@/types/history';

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

  getMonthlyByYear(year: number) {
    return api.get<MonthlySummaryResponse[]>(`/history/monthly/${year}`);
  },

  getMonthly(year: number, month: number) {
    return api.get<MonthlySummaryResponse>(`/history/monthly/${year}/${month}`);
  },
};
