import { useEffect, useState } from 'react';

/**
 * useState that survives navigation and reloads within the browser session.
 *
 * Used to remember small UI positions (the active tab on Today and Templates,
 * the week shown on Progress) so switching screens never loses your place.
 * Backed by sessionStorage on purpose: a fresh visit starts from the defaults
 * instead of wherever the last visit happened to end.
 */
export function usePersistedState<T extends string>(
  key: string,
  initial: T,
  isValid: (v: string) => v is T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored !== null && isValid(stored)) return stored;
    } catch {
      /* storage unavailable */
    }
    return initial;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* storage unavailable */
    }
  }, [key, value]);

  return [value, setValue];
}
