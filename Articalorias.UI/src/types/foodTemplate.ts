import type { MacroAmounts } from './macros';

export interface FoodTemplateResponse {
  foodTemplateId: number;
  templateName: string;
  portionDescription: string;
  defaultQuantity: number;
  caloriesKcal: number;
  /** Amounts PER 1 PORTION keyed by macro key (absent = not captured). */
  macros: MacroAmounts;
  autoAddToNewDay: boolean;
  isActive: boolean;
}

export interface CreateFoodTemplateRequest {
  templateName: string;
  portionDescription: string;
  defaultQuantity: number;
  caloriesKcal: number;
  /** Amounts PER 1 PORTION keyed by macro key. */
  macros: MacroAmounts;
  autoAddToNewDay: boolean;
}

export interface UpdateFoodTemplateRequest {
  templateName: string;
  portionDescription: string;
  defaultQuantity: number;
  caloriesKcal: number;
  /** Amounts PER 1 PORTION keyed by macro key. */
  macros: MacroAmounts;
  autoAddToNewDay: boolean;
}
