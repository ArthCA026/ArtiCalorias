import api from './api';
import type {
  DailyLogResponse,
  DailyDashboardResponse,
  ParseFoodRequest,
  ParseFoodWithImageRequest,
  ParsedFoodItem,
  ConfirmParsedFoodsRequest,
  FoodEntryResponse,
  ParseActivityRequest,
  ParsedActivityItem,
  ConfirmParsedActivitiesRequest,
  ActivityEntryResponse,
} from '@/types';

export const dailyLogService = {
  getByDate(date: string) {
    return api.get<DailyLogResponse>(`/dailylog/${date}`);
  },

  getDashboard(date: string) {
    return api.get<DailyDashboardResponse>(`/dailylog/${date}/dashboard`);
  },

  recalculate(date: string) {
    return api.post<DailyLogResponse>(`/dailylog/${date}/recalculate`);
  },

  /** Updates all profile snapshot fields on the log for today, then recalculates. */
  refreshSnapshot(date: string) {
    return api.post<DailyLogResponse | null>(`/dailylog/${date}/refresh-snapshot`);
  },

  /**
   * Refreshes profile snapshots + recalculates every DailyLog where weight or
   * height snapshot was null (i.e. created before the user completed their profile).
   * Returns the number of logs that were fixed.
   */
  refreshStaleSnapshots() {
    return api.post<{ count: number }>('/dailylog/refresh-stale-snapshots');
  },

  parseFood(date: string, data: ParseFoodRequest) {
    return api.post<ParsedFoodItem[]>(`/dailylog/${date}/parse-food`, data);
  },

  parseFoodWithImage(date: string, data: ParseFoodWithImageRequest) {
    return api.post<ParsedFoodItem[]>(`/dailylog/${date}/parse-food-image`, data);
  },

  confirmParsedFoods(date: string, data: ConfirmParsedFoodsRequest) {
    return api.post<FoodEntryResponse[]>(`/dailylog/${date}/foods/batch`, data);
  },

  parseActivity(date: string, data: ParseActivityRequest) {
    return api.post<ParsedActivityItem[]>(`/dailylog/${date}/parse-activity`, data);
  },

  confirmParsedActivities(date: string, data: ConfirmParsedActivitiesRequest) {
    return api.post<ActivityEntryResponse[]>(`/dailylog/${date}/activities/batch`, data);
  },

  deleteDay(date: string) {
    return api.delete(`/dailylog/${date}`);
  },

  lookupBarcode(barcode: string) {
    return api.post<ParsedFoodItem[]>('/foods/by-barcode', { barcode });
  },
};
