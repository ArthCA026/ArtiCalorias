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
 * Usage: <div {...longPressHandlers} />
 */
export function useLongPress({ delay = 450, onLongPress, onTap }: LongPressOptions) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
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
      onContextMenu: (e: React.MouseEvent) => {
        // Long press on mobile browsers triggers the native context menu
        e.preventDefault();
      },
    };
  }, [delay, onLongPress, onTap, haptics]);
}
