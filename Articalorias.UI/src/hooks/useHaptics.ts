/**
 * Haptic feedback wrapper. Silently no-ops where unsupported (iOS Safari).
 * Used for immediate physical feedback on key interactions.
 */
function vibrate(pattern: number | number[]) {
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    /* unsupported */
  }
}

export function useHaptics() {
  return {
    /** Light tick: button presses, toggles, selection changes */
    tap: () => vibrate(8),
    /** Confirmation: successful save, item logged */
    success: () => vibrate([10, 40, 14]),
    /** Attention: long press recognized */
    hold: () => vibrate(16),
    /** Something went wrong */
    error: () => vibrate([24, 60, 24]),
  };
}
