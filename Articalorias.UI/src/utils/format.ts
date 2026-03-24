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
