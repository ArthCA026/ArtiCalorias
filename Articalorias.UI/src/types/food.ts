import type { MacroAmounts } from './macros';

export interface FoodEntryResponse {
  foodEntryId: number;
  foodName: string;
  portionDescription: string | null;
  quantity: number | null;
  caloriesKcal: number;
  /**
   * TOTAL amounts eaten keyed by macro key. Absent key = not captured when
   * this entry was logged (macro not tracked then); core macros always present.
   */
  macros: MacroAmounts;
  sortOrder: number;
  notes: string | null;
}

export interface CreateFoodEntryRequest {
  foodName: string;
  portionDescription?: string | null;
  quantity?: number | null;
  caloriesKcal: number;
  /** TOTAL amounts keyed by macro key. Omit a key to record "not captured". */
  macros: MacroAmounts;
  foodTemplateId?: number;
  notes?: string | null;
}

export interface UpdateFoodEntryRequest {
  foodName: string;
  portionDescription?: string | null;
  quantity?: number | null;
  caloriesKcal: number;
  /** TOTAL amounts keyed by macro key. Ignored when scaleByQuantity is true. */
  macros: MacroAmounts;
  notes?: string | null;
  /** When true the API scales the stored calories and the whole macro map by newQty/oldQty. */
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
  /** Already multiplied by quantity. Optional macros present only when tracked (AI) or on the label (barcode). */
  macros: MacroAmounts;
}

export interface ConfirmParsedFoodsRequest {
  items: CreateFoodEntryRequest[];
}

export interface ParseFoodWithImageRequest {
  imageBase64: string;
  mimeType: string;
  freeText?: string | null;
}
