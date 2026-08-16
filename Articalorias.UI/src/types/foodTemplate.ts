export interface FoodTemplateResponse {
  foodTemplateId: number;
  templateName: string;
  portionDescription: string;
  defaultQuantity: number;
  caloriesKcal: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
  alcoholGrams: number;
  sugarGrams: number | null;
  waterMl: number | null;
  autoAddToNewDay: boolean;
  isActive: boolean;
}

export interface CreateFoodTemplateRequest {
  templateName: string;
  portionDescription: string;
  defaultQuantity: number;
  caloriesKcal: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
  alcoholGrams: number;
  sugarGrams?: number | null;
  waterMl?: number | null;
  autoAddToNewDay: boolean;
}

export interface UpdateFoodTemplateRequest {
  templateName: string;
  portionDescription: string;
  defaultQuantity: number;
  caloriesKcal: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
  alcoholGrams: number;
  sugarGrams?: number | null;
  waterMl?: number | null;
  autoAddToNewDay: boolean;
}
