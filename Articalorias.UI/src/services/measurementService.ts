import api from './api';
import { toDateString } from '@/utils/format';
import type { BodyMeasurement, UpsertBodyMeasurementRequest } from '@/types';

export const measurementService = {
  getAll() {
    return api.get<BodyMeasurement[]>('/measurements');
  },

  /**
   * Creates or updates the measurement of one calendar day. The device's
   * local date travels along so "not in the future" and the profile sync run
   * on the user's calendar, not the server's.
   */
  upsert(date: string, data: UpsertBodyMeasurementRequest) {
    return api.put<BodyMeasurement>(`/measurements/${date}`, data, {
      params: { today: toDateString() },
    });
  },

  remove(date: string) {
    return api.delete(`/measurements/${date}`, {
      params: { today: toDateString() },
    });
  },
};
