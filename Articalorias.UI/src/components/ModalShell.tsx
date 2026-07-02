import type { ReactNode } from 'react';

interface ModalShellProps {
  children: ReactNode;
  onClose: () => void;
}

/**
 * Shared backdrop + panel wrapper for all form modals.
 * Clicking the backdrop calls onClose.
 */
export function ModalShell({ children, onClose }: ModalShellProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
        <div className="w-full max-w-sm rounded-2xl bg-surface shadow-2xl p-6 flex flex-col gap-4 overflow-y-auto max-h-[85vh]">
        {children}
      </div>
    </div>
  );
}
