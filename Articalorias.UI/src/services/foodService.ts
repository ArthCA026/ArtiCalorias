import api from './api';
import type {
  FoodEntryResponse,
  CreateFoodEntryRequest,
  UpdateFoodEntryRequest,
} from '@/types';

export const foodService = {
  getByDate(date: string) {
    return api.get<FoodEntryResponse[]>(`/dailylog/${date}/foods`);
  },

  create(date: string, data: CreateFoodEntryRequest) {
    return api.post<FoodEntryResponse>(`/dailylog/${date}/foods`, data);
  },

  update(date: string, foodEntryId: number, data: UpdateFoodEntryRequest) {
    return api.put<FoodEntryResponse>(`/dailylog/${date}/foods/${foodEntryId}`, data);
  },

  remove(date: string, foodEntryId: number) {
    return api.delete(`/dailylog/${date}/foods/${foodEntryId}`);
  },

  /** Multi-select delete: one recalculation for the whole selection. */
  removeBatch(date: string, foodEntryIds: number[]) {
    return api.post<{ deleted: number }>(`/dailylog/${date}/foods/delete-batch`, {
      foodEntryIds,
    });
  },
};
