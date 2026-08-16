import { useEffect, useState } from 'react';
import { userService } from '@/services/userService';

const LAST_SENT_KEY = 'ac-last-heartbeat';
const THROTTLE_MS = 30 * 60 * 1000; // at most one ping per half hour
const AWAY_MS = 48 * 60 * 60 * 1000; // "coming back" threshold
const GATE_TIMEOUT_MS = 2000;

function lastSentAt(): number {
  try {
    return Number(localStorage.getItem(LAST_SENT_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function sendHeartbeat(): Promise<void> {
  const prev = lastSentAt();
  if (Date.now() - prev < THROTTLE_MS) return Promise.resolve();
  try {
    localStorage.setItem(LAST_SENT_KEY, String(Date.now()));
  } catch {
    /* storage unavailable */
  }
  return userService.heartbeat().catch(() => {
    // Failed ping: restore the old stamp so the next visibility change retries.
    try {
      localStorage.setItem(LAST_SENT_KEY, String(prev));
    } catch {
      /* storage unavailable */
    }
  });
}

/**
 * Tells the server the user is actually HERE. Fired on mount and whenever the
 * app becomes visible again, throttled to one ping per half hour. Background
 * refetches never count: presence means the user opened the app, and this is
 * what keeps template auto-add alive (it pauses after days of silence).
 *
 * Returns false only while gating a "returning after days away" open: the
 * ping must land BEFORE the first dashboard request creates today's row, or
 * the comeback day would be built while the server still believes the user is
 * gone (and their routine meals would be skipped). Bounded by a short timeout
 * so a slow network can never hold the app hostage.
 */
export function useHeartbeat(): boolean {
  const [ready, setReady] = useState(() => Date.now() - lastSentAt() < AWAY_MS);

  useEffect(() => {
    let cancelled = false;

    if (!ready) {
      const timeout = new Promise<void>((resolve) => setTimeout(resolve, GATE_TIMEOUT_MS));
      Promise.race([sendHeartbeat(), timeout]).then(() => {
        if (!cancelled) setReady(true);
      });
    } else {
      void sendHeartbeat();
    }

    // Becoming visible again IS user presence (switching back to the app);
    // a hidden tab firing queries in the background is not.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void sendHeartbeat();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
    // Mount-only: `ready` intentionally captured once — the gate runs a single time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready;
}
