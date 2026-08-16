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
  /** Null = not captured when this entry was logged (macro not tracked then). */
  sugarGrams: number | null;
  waterMl: number | null;
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
  sugarGrams?: number | null;
  waterMl?: number | null;
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
  sugarGrams?: number | null;
  waterMl?: number | null;
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
  /** Only present when the user tracks the macro. */
  sugarGrams: number | null;
  waterMl: number | null;
}

export interface ConfirmParsedFoodsRequest {
  items: CreateFoodEntryRequest[];
}

export interface ParseFoodWithImageRequest {
  imageBase64: string;
  mimeType: string;
  freeText?: string | null;
}
