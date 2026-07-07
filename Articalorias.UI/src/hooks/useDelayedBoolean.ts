import { useState, useEffect } from 'react';

/**
 * Returns `false` until `value` has been `true` for at least `delayMs` milliseconds.
 * Resets immediately when `value` becomes `false`.
 *
 * Use to prevent skeleton flicker on fast loads: show the skeleton only if the
 * loading state persists beyond the delay threshold.
 */
export function useDelayedBoolean(value: boolean, delayMs: number): boolean {
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    if (!value) {
      setDelayed(false);
      return;
    }
    const timer = setTimeout(() => setDelayed(true), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return delayed;
}
