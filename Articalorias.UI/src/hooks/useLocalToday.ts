import { useEffect, useState } from 'react';
import { toDateString } from '@/utils/format';

/**
 * The device's local calendar date, kept current while the app stays open.
 *
 * `toDateString()` read once at render goes stale in an installed PWA that
 * lives in memory across midnight: Today would keep showing yesterday and
 * Progress would keep calling the wrong row "Today" until a full reload. The
 * date is re-read on the app becoming visible again (the common resume path)
 * and on a timer armed for the next local midnight, DST shifts included,
 * because the Date constructor works in local wall-clock time.
 */
export function useLocalToday(): string {
  const [today, setToday] = useState(() => toDateString());

  useEffect(() => {
    const check = () => {
      const now = toDateString();
      setToday((prev) => (prev === now ? prev : now));
    };

    let timer = 0;
    const arm = () => {
      const now = new Date();
      // One second past midnight, so a timer that fires a hair early never
      // reads the old date and then sleeps a whole day.
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = window.setTimeout(() => {
        check();
        arm();
      }, Math.min(next.getTime() - now.getTime(), 0x7fffffff));
    };
    arm();

    // Background tabs throttle timers, so a resume is checked explicitly.
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return today;
}
