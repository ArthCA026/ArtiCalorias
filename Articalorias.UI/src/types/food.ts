export interface FoodEntryResponse {
  foodEntryId: number;
  foodName: string;
  portionDescription: string | null;
  quantity: number | null;
  caloriesKcal: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
  alcoholGrams: number;
  sortOrder: number;
  notes: string | null;
}

export interface CreateFoodEntryRequest {
  foodName: string;
  portionDescription?: string | null;
  quantity?: number | null;
  caloriesKcal: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
  alcoholGrams: number;
  foodTemplateId?: number;
  notes?: string | null;
}

export interface UpdateFoodEntryRequest {
  foodName: string;
  portionDescription?: string | null;
  quantity?: number | null;
  caloriesKcal: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
  alcoholGrams: number;
  notes?: string | null;
  /** When true the API scales existing macros by newQty/oldQty instead of using the submitted macro values. */
  scaleByQuantity?: boolean;
}

export interface ParseFoodRequest {
  freeText: string;
}

export interface ParsedFoodItem {
  foodName: string;
  portionDescription: string | null;
  quantity: number | null;
  caloriesKcal: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
  alcoholGrams: number;
}

export interface ConfirmParsedFoodsRequest {
  items: CreateFoodEntryRequest[];
}

export interface ParseFoodWithImageRequest {
  imageBase64: string;
  mimeType: string;
  freeText?: string | null;
}
