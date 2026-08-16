export interface BodyMeasurement {
  /** yyyy-MM-dd, the user's local calendar day. One measurement per day. */
  measuredOn: string;
  weightKg: number | null;
  bodyFatPercent: number | null;
  /** "manual" | "profile" (profile save) | "history" (backfilled). */
  source: string;
}

export interface UpsertBodyMeasurementRequest {
  weightKg?: number | null;
  bodyFatPercent?: number | null;
}
