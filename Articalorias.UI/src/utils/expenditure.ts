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

/**
 * Mirror of Services/IntakeSafeguard.cs: the minimum daily intake the app
 * will suggest while the safeguard is on (it is on for every new account).
 */
export const SAFEGUARD_FEMALE_FLOOR_KCAL = 1200;
export const SAFEGUARD_DEFAULT_FLOOR_KCAL = 1500;
export const SAFEGUARD_BMR_SHARE = 0.8;
export const SAFEGUARD_KCAL_PER_KG_FFM = 30;

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

export interface SafeguardInput {
  sex: 'M' | 'F' | '';
  bmrKcal: number;
  weightKg: number | null;
  /** Measured or estimated; null falls back to the full BMR like the server does. */
  bodyFatPercent: number | null;
}

/**
 * Highest of three floors: the sex-based absolute minimum, 80 % of the BMR,
 * and 30 kcal per kg of fat-free mass (the full BMR when body fat is
 * unknown). A day with no logged workouts, so no exercise term.
 */
export function minimumDailyIntakeKcal({ sex, bmrKcal, weightKg, bodyFatPercent }: SafeguardInput): number {
  const sexFloor = sex === 'F' ? SAFEGUARD_FEMALE_FLOOR_KCAL : SAFEGUARD_DEFAULT_FLOOR_KCAL;
  const bmrFloor = bmrKcal * SAFEGUARD_BMR_SHARE;
  const eaFloor =
    bodyFatPercent !== null && bodyFatPercent > 0 && weightKg !== null
      ? SAFEGUARD_KCAL_PER_KG_FFM * weightKg * (1 - bodyFatPercent / 100)
      : bmrKcal;
  return Math.max(sexFloor, eaFloor, bmrFloor);
}

/**
 * The intake that closes the day on the goal: maintenance plus the signed
 * goal, grossed up for the TEF of eating that much, never under the
 * minimum-intake safeguard when one is given. This is the number the Today
 * "goal" budget settles on once the day has been eaten (the Today budget
 * itself only counts the TEF of food already logged).
 */
export function estimateDailyBudgetKcal(
  input: MaintenanceInput,
  goalKcal: number,
  safeguard: SafeguardInput | null = null,
): number {
  const budget = (estimateMaintenanceKcal(input) + goalKcal) / (1 - NOMINAL_TEF_FRACTION);
  return safeguard ? Math.max(budget, minimumDailyIntakeKcal(safeguard)) : budget;
}

export function reservedHoursFit(sleepHours: number, neatHours: number): boolean {
  return sleepHours + neatHours <= MAX_RESERVED_HOURS;
}
