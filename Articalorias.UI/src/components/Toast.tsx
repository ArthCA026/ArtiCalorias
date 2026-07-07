import { useState, useEffect, useRef } from 'react';

// ── hook ────────────────────────────────────────────────────────────────────

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [exiting, setExiting] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string, type: 'success' | 'error') {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    if (exitTimer.current) clearTimeout(exitTimer.current);
    setExiting(false);
    setToast({ message, type });
    dismissTimer.current = setTimeout(() => {
      setExiting(true);
      exitTimer.current = setTimeout(() => {
        setToast(null);
        setExiting(false);
      }, 300);
    }, 3000);
  }

  return { toast, exiting, showToast };
}

// ── component ────────────────────────────────────────────────────────────────

export function Toast({
  message,
  type,
  exiting = false,
}: {
  message: string;
  type: 'success' | 'error';
  exiting?: boolean;
}) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const visible = entered && !exiting;
  return (
    <div
      role={type === 'success' ? 'status' : 'alert'}
      style={{ bottom: 'max(80px, calc(var(--dock-height, 0px) + 12px))' }}
      className={`fixed left-1/2 -translate-x-1/2 z-51 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-sm font-medium pointer-events-none max-w-xs w-[calc(100%-2rem)] transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      } ${
        type === 'success'
          ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
          : 'bg-danger text-danger-fg'
      }`}
    >
      {type === 'success' ? (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
      <span className="truncate">{message}</span>
    </div>
  );
}

