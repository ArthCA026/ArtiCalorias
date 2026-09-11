// ── Age-aware minimum protein ─────────────────────────────────────────────────
//
// The protein presets themselves (light 1.0 ... muscle gain 2.0 g/kg) now come
// from the macro catalog (GET /api/macros/catalog, macro "protein",
// autoPresets). Only the age floor stays client-side: it is what turns a
// preset into a grams preview before the server answers.

/** Evidence-informed minimum protein multipliers (g/kg body weight) by age tier. */
export const AGE_PROTEIN_MINIMUMS = {
  /** Under 50 years: 1.0 g/kg minimum. */
  UNDER_50: 1.0,
  /** 50–64 years: 1.1 g/kg minimum. */
  FROM_50: 1.1,
  /** 65+ years: 1.2 g/kg minimum. */
  FROM_65: 1.2,
} as const;

/**
 * Returns the evidence-informed minimum protein multiplier (g/kg) for the
 * given age. The result is used as a floor: the final multiplier is
 * Math.max(selectedPreset.param, getAgeProteinMinimum(age)). Mirrors the
 * backend (MacroFormulas.AgeMinimumGramsPerKg).
 */
export function getAgeProteinMinimum(age: number): number {
  if (age >= 65) return AGE_PROTEIN_MINIMUMS.FROM_65;
  if (age >= 50) return AGE_PROTEIN_MINIMUMS.FROM_50;
  return AGE_PROTEIN_MINIMUMS.UNDER_50;
}
