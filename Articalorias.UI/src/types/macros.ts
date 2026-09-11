/**
 * Macro keys are open-ended: whatever the API catalog (GET /api/macros/catalog)
 * defines. "protein", "fat", "carbs", "alcohol", "sugar", "water", "caffeine",
 * "sodium" today; anything the backend adds tomorrow renders without a UI change.
 */
export type MacroKey = string;

export type MacroUnit = 'g' | 'ml' | 'mg';
export type MacroDirection = 'hit' | 'limit';
export type MacroTargetMode = 'auto' | 'custom';
export type MacroRowStrip = 'always' | 'whenTracked';

/** Amounts keyed by macro key. Absent key = not captured (never a fake 0). */
export type MacroAmounts = Record<string, number>;

/** Copy shipped by the API in both app languages. */
export interface LocalizedText {
  en: string;
  es: string;
}

export type MacroFormulaKind =
  | 'none'
  | 'perKgBodyWeight'
  | 'percentOfBudget'
  | 'carbsRemainder'
  | 'fixedAmount'
  | 'perKgBodyWeightCapped'
  | 'perThousandKcal';

export interface MacroFormula {
  kind: MacroFormulaKind;
  /** False = no auto target exists (alcohol): a target only exists when custom. */
  hasAutoTarget: boolean;
  /** True when the user can tune the formula (protein g/kg presets). */
  hasAutoParam: boolean;
  defaultParam: number | null;
  paramMin: number | null;
  paramMax: number | null;
  /** The reference amount: the fixed value, or the ceiling of a capped per-kg formula. */
  fixedValue: number | null;
}

export interface MacroAutoPreset {
  id: string;
  param: number;
  labels: { name: LocalizedText; description: LocalizedText };
}

export interface MacroQuickAdd {
  id: string;
  icon: string;
  labels: { name: LocalizedText; portion: LocalizedText };
  amount: number;
  caloriesKcal: number;
  /** Entry macros with core zeros expanded; the client keeps only the keys the day tracks. */
  macros: MacroAmounts;
}

/** One catalog record: everything a screen needs to render a macro. */
export interface MacroDefinition {
  key: MacroKey;
  sortOrder: number;
  unit: MacroUnit;
  direction: MacroDirection;
  /** Always parsed and always present on stored data. */
  isCore: boolean;
  defaultTracked: boolean;
  icon: string;
  labels: { name: LocalizedText; shortName: LocalizedText };
  targetFormula: MacroFormula;
  autoPresets: MacroAutoPreset[];
  customTargetMin: number;
  customTargetMax: number;
  quickAdds: MacroQuickAdd[];
  showInHeroBars: boolean;
  rowStrip: MacroRowStrip;
  hasOwnCard: boolean;
  /** Retired macros keep rendering history but cannot be tracked anew. */
  isActive: boolean;
}

export interface MacroCatalogResponse {
  catalogVersion: string;
  macros: MacroDefinition[];
}

export interface MacroPreference {
  macroKey: MacroKey;
  isTracked: boolean;
  targetMode: MacroTargetMode;
  customTargetValue: number | null;
  /** The auto-formula parameter in effect (protein g/kg); null when the macro has none. */
  autoParam: number | null;
  /** What the auto formula currently yields (null = profile incomplete or no formula). */
  autoTargetValue: number | null;
  /** The target a new day would freeze right now. */
  effectiveTarget: number | null;
  direction: MacroDirection;
}

export interface UpdateMacroPreferenceItem {
  macroKey: MacroKey;
  isTracked: boolean;
  targetMode: MacroTargetMode;
  /** Omitted = keep the stored value. */
  customTargetValue?: number | null;
  /** Omitted = keep the stored value. Only macros with hasAutoParam accept it. */
  autoParam?: number | null;
}

export interface UpdateMacroPreferencesRequest {
  items: UpdateMacroPreferenceItem[];
}
