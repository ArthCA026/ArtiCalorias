/** The optional macros. Protein is separate: it keeps its profile-based goal. */
export type MacroKey = 'carbs' | 'fat' | 'alcohol' | 'sugar' | 'water';

export type MacroTargetMode = 'auto' | 'custom';

export interface MacroPreference {
  macroKey: MacroKey;
  isTracked: boolean;
  targetMode: MacroTargetMode;
  customTargetValue: number | null;
  /** What the auto formula currently yields (null = profile incomplete or no formula). */
  autoTargetValue: number | null;
  /** The target a new day would freeze right now. */
  effectiveTarget: number | null;
  direction: 'hit' | 'limit';
}

export interface UpdateMacroPreferenceItem {
  macroKey: MacroKey;
  isTracked: boolean;
  targetMode: MacroTargetMode;
  customTargetValue?: number | null;
}

export interface UpdateMacroPreferencesRequest {
  items: UpdateMacroPreferenceItem[];
}
