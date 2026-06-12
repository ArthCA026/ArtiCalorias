import api from './api';

export type ReminderType = 'breakfast' | 'lunch' | 'dinner';

export interface ReminderSchedule {
  type: ReminderType;
  enabled: boolean;
  hourUtc: number;
  minuteUtc: number;
}

export const notificationService = {
  getSchedules: () => api.get<ReminderSchedule[]>('/pushnotification/schedules'),
  updateSchedules: (schedules: ReminderSchedule[]) =>
    api.put('/pushnotification/schedules', { schedules }),
};
