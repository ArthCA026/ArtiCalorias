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
