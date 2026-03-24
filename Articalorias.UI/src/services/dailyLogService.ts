import api from './api';
import type {
  DailyLogResponse,
  DailyDashboardResponse,
  ParseFoodRequest,
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

  parseFood(date: string, data: ParseFoodRequest) {
    return api.post<ParsedFoodItem[]>(`/dailylog/${date}/parse-food`, data);
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
};
