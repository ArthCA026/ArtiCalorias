/** Converts a local hour+minute to UTC, handling day rollover. */
export function localToUtc(localHour: number, localMinute: number): { hourUtc: number; minuteUtc: number } {
  const d = new Date();
  d.setHours(localHour, localMinute, 0, 0);
  return { hourUtc: d.getUTCHours(), minuteUtc: d.getUTCMinutes() };
}

/** Converts a UTC hour+minute to local time, handling day rollover. */
export function utcToLocal(hourUtc: number, minuteUtc: number): { hour: number; minute: number } {
  const d = new Date();
  d.setUTCHours(hourUtc, minuteUtc, 0, 0);
  return { hour: d.getHours(), minute: d.getMinutes() };
}

/** Formats hour+minute as a 12-hour clock string e.g. "8:00 AM". */
export function formatLocalTime(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** Returns an "HH:MM" string for use in <input type="time">. */
export function toTimeInputValue(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Parses an "HH:MM" string into { hour, minute }. */
export function fromTimeInputValue(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(':').map(Number);
  return { hour: h ?? 0, minute: m ?? 0 };
}
