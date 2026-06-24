import type { FoodTemplateResponse } from './foodTemplate';
import type { ActivityTemplateResponse, ParsedActivityItem } from './activity';
import type { ParsedFoodItem } from './food';

export type { ParsedActivityItem, ParsedFoodItem };

export interface ParsedFavoriteItem {
  type: 'activity' | 'food';
  activity: ParsedActivityItem | null;
  food: ParsedFoodItem | null;
}

export interface ParseFavoriteResponse {
  items: ParsedFavoriteItem[];
}

// Routine types (P3)
export interface FavoriteRoutineItemResponse {
  favoriteRoutineItemId: number;
  itemType: 'activity' | 'food';
  sortOrder: number;
  activityTemplate: ActivityTemplateResponse | null;
  foodTemplate: FoodTemplateResponse | null;
}

export interface FavoriteRoutineResponse {
  favoriteRoutineId: number;
  routineName: string;
  sortOrder: number;
  items: FavoriteRoutineItemResponse[];
}

export interface CreateFavoriteRoutineItemRequest {
  itemType: 'activity' | 'food';
  activityTemplateId: number | null;
  foodTemplateId: number | null;
  sortOrder: number;
}

export interface CreateFavoriteRoutineRequest {
  routineName: string;
  items: CreateFavoriteRoutineItemRequest[];
}

export interface AddRoutineToTodayResponse {
  addedCount: number;
  skippedItems: { favoriteRoutineItemId: number; reason: string }[];
}
