import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';
import { IconButton } from './Button';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Extra classes for the panel */
  className?: string;
  /** Hide the drag handle + close affordances (rare) */
  dismissible?: boolean;
}

/**
 * Bottom sheet: the primary container for actions and forms on mobile.
 * Slides from the bottom, drag-down or backdrop tap to dismiss,
 * respects the bottom safe area, scrolls internally.
 */
export function Sheet({ open, onClose, title, children, className, dismissible = true }: SheetProps) {
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape to close (hardware keyboards / desktop testing)
  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissible, onClose]);

  if (!open) return null;

  const onHandlePointerDown = (e: React.PointerEvent) => {
    if (!dismissible) return;
    dragStart.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onHandlePointerMove = (e: React.PointerEvent) => {
    if (dragStart.current === null) return;
    setDragY(Math.max(0, e.clientY - dragStart.current));
  };
  const onHandlePointerUp = () => {
    if (dragStart.current === null) return;
    const shouldClose = dragY > 90;
    dragStart.current = null;
    setDragY(0);
    if (shouldClose) onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-overlay animate-fade-in"
        onClick={dismissible ? onClose : undefined}
      />
      <div
        ref={panelRef}
        className={cn(
          'absolute inset-x-0 bottom-0 rounded-t-3xl bg-card animate-slide-up',
          'max-h-[92dvh] flex flex-col',
          className,
        )}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        <div
          className="shrink-0 pt-2.5 pb-1 flex justify-center touch-none cursor-grab"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        >
          <div className="h-1.5 w-10 rounded-full bg-press" />
        </div>
        {(title || dismissible) && (
          <div className="shrink-0 flex items-center justify-between px-5 pb-1 min-h-10">
            <h2 className="text-lg font-bold text-ink">{title}</h2>
            {dismissible && (
              <IconButton icon="close" label="Close" size={36} iconSize={19} variant="inset" onClick={onClose} />
            )}
          </div>
        )}
        <div className="overflow-y-auto overscroll-contain px-5 pb-6 pb-safe grow">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
