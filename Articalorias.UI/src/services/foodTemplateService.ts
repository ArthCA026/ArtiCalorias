import api from './api';
import type {
  FoodTemplateResponse,
  CreateFoodTemplateRequest,
  UpdateFoodTemplateRequest,
  ParseFavoriteResponse,
  FavoriteRoutineResponse,
  CreateFavoriteRoutineRequest,
  AddRoutineToTodayResponse,
} from '@/types';

export const foodTemplateService = {
  // --- Food Templates ---

  getAll() {
    return api.get<FoodTemplateResponse[]>('/favorites/food-templates');
  },

  create(data: CreateFoodTemplateRequest) {
    return api.post<FoodTemplateResponse>('/favorites/food-templates', data);
  },

  update(id: number, data: UpdateFoodTemplateRequest) {
    return api.put<FoodTemplateResponse>(`/favorites/food-templates/${id}`, data);
  },

  remove(id: number) {
    return api.delete(`/favorites/food-templates/${id}`);
  },

  getRoutinesForFoodTemplate(id: number) {
    return api.get<string[]>(`/favorites/food-templates/${id}/routines`);
  },

  // --- AI Parse ---

  parseFavoriteActivity(text: string) {
    return api.post<ParseFavoriteResponse>('/favorites/parse-activity', { text });
  },

  parseFavoriteFood(text: string) {
    return api.post<ParseFavoriteResponse>('/favorites/parse-food', { text });
  },

  parseFavorites(text: string, type?: 'activity' | 'food') {
    return api.post<ParseFavoriteResponse>('/favorites/parse', { text, type });
  },

  // --- Routines ---

  getRoutines() {
    return api.get<FavoriteRoutineResponse[]>('/favorites/routines');
  },

  createRoutine(data: CreateFavoriteRoutineRequest) {
    return api.post<FavoriteRoutineResponse>('/favorites/routines', data);
  },

  updateRoutine(id: number, data: CreateFavoriteRoutineRequest) {
    return api.put<FavoriteRoutineResponse>(`/favorites/routines/${id}`, data);
  },

  removeRoutine(id: number) {
    return api.delete(`/favorites/routines/${id}`);
  },

  addRoutineToToday(id: number) {
    return api.post<AddRoutineToTodayResponse>(`/favorites/routines/${id}/add-to-today`);
  },
};
