import api from './api';
import { toDateString } from '@/utils/format';
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
  /**
   * Both reads create the day on first request. The device's local date
   * travels along so the server decides "is this the user's today" (which
   * gates routine auto-add) on the same calendar the screen shows, even when
   * the stored profile timezone is stale after a trip.
   */
  getByDate(date: string) {
    return api.get<DailyLogResponse>(`/dailylog/${date}`, {
      params: { today: toDateString() },
    });
  },

  getDashboard(date: string) {
    return api.get<DailyDashboardResponse>(`/dailylog/${date}/dashboard`, {
      params: { today: toDateString() },
    });
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

  /**
   * Marks or unmarks a day as a deliberate fasting day. The device's local
   * date travels along so the server updates budgets on the user's calendar.
   */
  setFasting(date: string, isFasting: boolean) {
    return api.put<DailyLogResponse>(`/dailylog/${date}/fasting`, { isFasting }, {
      params: { today: toDateString() },
    });
  },

  lookupBarcode(barcode: string) {
    return api.post<ParsedFoodItem[]>('/foods/by-barcode', { barcode });
  },
};
