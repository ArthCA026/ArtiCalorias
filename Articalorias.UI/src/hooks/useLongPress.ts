import { useMemo, useRef } from 'react';
import { useHaptics } from './useHaptics';

interface LongPressOptions {
  /** ms before the press counts as a long press */
  delay?: number;
  /** Fires once when the long press threshold is reached */
  onLongPress: () => void;
  /** Optional normal tap handler (suppressed after a long press) */
  onTap?: () => void;
}

/**
 * Long-press gesture for touch and mouse. Cancels on >10px movement or
 * scroll. Fires a haptic when the hold is recognized so the user knows
 * something happened before lifting their finger.
 *
 * Touch quirk this hook owns: after `pointerup`, touch browsers synthesize a
 * compatibility `click`, hit-tested against the DOM AS IT IS THEN. When the
 * tap handler mounts an overlay (an edit sheet), that ghost click lands on
 * the brand-new backdrop and closes it in the same breath it opened - taps
 * "do nothing" on phones while working fine with a mouse (a real click
 * targets the original row). Canceling `touchend` for any gesture we handled
 * suppresses the synthesized click. Scrolls are unaffected: the browser
 * fires `pointercancel` first, so nothing was handled.
 *
 * Usage: <div {...longPressHandlers} />
 */
export function useLongPress({ delay = 450, onLongPress, onTap }: LongPressOptions) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  // pointerup runs BEFORE touchend, so it flags the consumed gesture here
  // for the touchend handler to act on.
  const consumedTouch = useRef(false);
  const haptics = useHaptics();

  return useMemo(() => {
    const clear = () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };

    return {
      onPointerDown: (e: React.PointerEvent) => {
        fired.current = false;
        consumedTouch.current = false;
        origin.current = { x: e.clientX, y: e.clientY };
        clear();
        timer.current = window.setTimeout(() => {
          fired.current = true;
          haptics.hold();
          onLongPress();
        }, delay);
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (!origin.current) return;
        const dx = Math.abs(e.clientX - origin.current.x);
        const dy = Math.abs(e.clientY - origin.current.y);
        if (dx > 10 || dy > 10) clear();
      },
      onPointerUp: () => {
        clear();
        // Any gesture that ran to completion on this element (tap or the
        // release after a long press) is ours; its ghost click must die.
        if (origin.current !== null) consumedTouch.current = true;
        if (!fired.current && origin.current && onTap) onTap();
        origin.current = null;
      },
      onPointerCancel: () => {
        clear();
        origin.current = null;
      },
      onPointerLeave: () => {
        clear();
      },
      onTouchEnd: (e: React.TouchEvent) => {
        if (consumedTouch.current && e.cancelable) e.preventDefault();
        consumedTouch.current = false;
      },
      onContextMenu: (e: React.MouseEvent) => {
        // Long press on mobile browsers triggers the native context menu
        e.preventDefault();
      },
    };
  }, [delay, onLongPress, onTap, haptics]);
}
