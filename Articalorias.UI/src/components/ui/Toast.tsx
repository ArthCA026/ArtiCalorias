import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';
import { Icon, type IconName } from './Icon';
import { useHaptics } from '@/hooks/useHaptics';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toastIcon: Record<ToastType, IconName> = {
  success: 'checkCircle',
  error: 'alertCircle',
  info: 'info',
};

/**
 * App-wide feedback toasts. Every mutation should confirm itself through
 * one of these so the user never wonders whether something happened.
 * Positioned above the tab bar.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const haptics = useHaptics();

  const toast = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId.current++;
      setItems((prev) => [...prev.slice(-2), { id, type, message }]);
      if (type === 'success') haptics.success();
      if (type === 'error') haptics.error();
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 2600);
    },
    [haptics],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          className="fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)' }}
          aria-live="polite"
        >
          {items.map((t) => (
            <div
              key={t.id}
              className={cn(
                'animate-pop flex items-center gap-2.5 rounded-2xl px-4 py-3 max-w-sm w-fit',
                'text-[15px] font-semibold shadow-lg',
                t.type === 'success' && 'bg-primary text-on-primary',
                t.type === 'error' && 'bg-danger text-white',
                t.type === 'info' && 'bg-ink text-app',
              )}
            >
              <Icon name={toastIcon[t.type]} size={19} />
              <span>{t.message}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- provider + hook belong together
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
