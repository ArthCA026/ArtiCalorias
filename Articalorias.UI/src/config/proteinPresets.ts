export type ProteinPresetId = "light" | "everyday" | "weight-loss-support" | "active-training" | "muscle-gain";

export interface ProteinPreset {
  id: ProteinPresetId;
  label: string;
  gramsPerKg: number;
  description: string;
}

export const PROTEIN_PRESETS: ProteinPreset[] = [
  { id: "light",              label: "Light",               gramsPerKg: 1.0, description: "A simple target if protein is not your main focus." },
  { id: "everyday",           label: "Everyday",            gramsPerKg: 1.2, description: "A balanced target for general daily eating." },
  { id: "weight-loss-support", label: "Weight Loss Support", gramsPerKg: 1.6, description: "A higher target to support fullness and muscle retention during weight loss." },
  { id: "active-training",    label: "Active Training",     gramsPerKg: 1.8, description: "A strong target for people who train regularly." },
  { id: "muscle-gain",        label: "Muscle Gain",         gramsPerKg: 2.0, description: "A high-protein target for lifting, recovery, and muscle gain goals." },
];

// ── Age-aware minimum protein ─────────────────────────────────────────────────

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
 * Math.max(selectedPreset.gramsPerKg, getAgeProteinMinimum(age)).
 */
export function getAgeProteinMinimum(age: number): number {
  if (age >= 65) return AGE_PROTEIN_MINIMUMS.FROM_65;
  if (age >= 50) return AGE_PROTEIN_MINIMUMS.FROM_50;
  return AGE_PROTEIN_MINIMUMS.UNDER_50;
}
