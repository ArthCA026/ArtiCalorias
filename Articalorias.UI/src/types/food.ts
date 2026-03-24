export interface FoodEntryResponse {
  foodEntryId: number;
  foodName: string;
  portionDescription: string | null;
  quantity: number | null;
  unit: string | null;
  caloriesKcal: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
  alcoholGrams: number;
  sourceType: string;
  sortOrder: number;
  notes: string | null;
}

export interface CreateFoodEntryRequest {
  foodName: string;
  portionDescription?: string | null;
  quantity?: number | null;
  unit?: string | null;
  caloriesKcal: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
  alcoholGrams: number;
  sourceType: string;
  notes?: string | null;
}

export interface UpdateFoodEntryRequest {
  foodName: string;
  portionDescription?: string | null;
  quantity?: number | null;
  unit?: string | null;
  caloriesKcal: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
  alcoholGrams: number;
  notes?: string | null;
}

export interface ParseFoodRequest {
  freeText: string;
}

export interface ParsedFoodItem {
  foodName: string;
  portionDescription: string | null;
  quantity: number | null;
  unit: string | null;
  caloriesKcal: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
  alcoholGrams: number;
}

export interface ConfirmParsedFoodsRequest {
  items: CreateFoodEntryRequest[];
}
