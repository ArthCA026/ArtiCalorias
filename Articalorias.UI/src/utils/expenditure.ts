/**
 * Mirror of Services/ExpenditureModel.cs on the server: the constants and
 * formulas behind the sleep / everyday-movement (NEAT) / idle model. The
 * client only needs them for the onboarding budget preview and the Profile
 * editor's limits; every stored number is computed server side. Keep both
 * files in step.
 *
 * Each block of hours contributes only its difference from resting, priced
 * at the MET reference rate of 1 kcal per kg per hour:
 *
 *   block kcal = (MET - 1) x weight kg x hours
 */
export const HOURS_PER_DAY = 24;
export const RESTING_MET = 1;
export const SLEEP_MET = 0.9;
export const NEAT_MET = 2.3;
export const IDLE_MET = 1.2;

/** Profile defaults written by onboarding, which does not ask for the hours. */
export const DEFAULT_SLEEP_HOURS = 8;
export const DEFAULT_NEAT_HOURS = 3;

/** Editor limits; the API enforces the same ones. */
export const MAX_SLEEP_HOURS = 16;
export const MAX_NEAT_HOURS = 16;
/** Sleep plus movement may reserve at most this many hours; one hour always stays free. */
export const MAX_RESERVED_HOURS = 23;

/** Thermic effect of a typical mixed diet, as a fraction of intake. */
export const NOMINAL_TEF_FRACTION = 0.1;

export interface MaintenanceInput {
  bmrKcal: number;
  weightKg: number;
  sleepHours: number;
  neatHours: number;
}

/** BMR plus the sleep, movement and idle deltas of a day with no logged workouts, before TEF. */
export function estimateMaintenanceKcal({ bmrKcal, weightKg, sleepHours, neatHours }: MaintenanceInput): number {
  const sleep = Math.min(Math.max(sleepHours, 0), HOURS_PER_DAY);
  const neat = Math.min(Math.max(neatHours, 0), HOURS_PER_DAY - sleep);
  const idle = HOURS_PER_DAY - sleep - neat;
  return (
    bmrKcal +
    (SLEEP_MET - RESTING_MET) * weightKg * sleep +
    (NEAT_MET - RESTING_MET) * weightKg * neat +
    (IDLE_MET - RESTING_MET) * weightKg * idle
  );
}

/**
 * The intake that closes the day on the goal: maintenance plus the signed
 * goal, grossed up for the TEF of eating that much. This is the number the
 * Today "goal" budget settles on once the day has been eaten.
 */
export function estimateDailyBudgetKcal(input: MaintenanceInput, goalKcal: number): number {
  return (estimateMaintenanceKcal(input) + goalKcal) / (1 - NOMINAL_TEF_FRACTION);
}

export function reservedHoursFit(sleepHours: number, neatHours: number): boolean {
  return sleepHours + neatHours <= MAX_RESERVED_HOURS;
}
