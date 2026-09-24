/** Returns a date string in yyyy-MM-dd format, local timezone. */
export function toDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Format a number with a fixed number of decimals. */
export function fmt(n: number, decimals = 0): string {
  return n.toFixed(decimals);
}

/** Round to one decimal place. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Grams for a row: "18.9", "14", "1.2". One decimal max, no trailing zero. */
export function g(n: number): string {
  return String(round1(n));
}

/** An amount as typed by the user: "2", "0.5", "1.25". No forced decimals. */
export function qtyStr(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

/** Parse a yyyy-MM-dd string as a local Date (no timezone shift). */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Add days to a yyyy-MM-dd string, returning yyyy-MM-dd. */
export function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

/** Monday of the week containing the given date (the API's week anchor). */
export function mondayOf(dateStr: string): string {
  const d = parseDate(dateStr);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return toDateString(d);
}

/**
 * Rounds each part to a whole number so the parts add up to the rounded
 * total (largest-remainder method). A breakdown rounded row by row can miss
 * its own total by one or two; a ledger that does not add up reads as a bug.
 * When the parts do not belong to the total in the first place (they differ
 * by more than rounding can explain), each is simply rounded on its own.
 */
export function roundPartsToTotal(parts: number[], total: number): number[] {
  const floors = parts.map(Math.floor);
  const missing = Math.round(total) - floors.reduce((a, b) => a + b, 0);
  if (!Number.isInteger(missing) || missing < 0 || missing > parts.length) return parts.map(Math.round);

  const byRemainder = parts
    .map((p, i) => ({ i, remainder: p - floors[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  const out = [...floors];
  for (let n = 0; n < missing; n += 1) out[byRemainder[n].i] += 1;
  return out;
}
