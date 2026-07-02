import { useTranslation } from 'react-i18next';

interface DeleteConfirmDialogProps {
  open: boolean;
  message: string;
  itemName?: string;
  affectedRoutines?: string[];
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
  isPending?: boolean;
}

export function DeleteConfirmDialog({
  open, message, itemName, affectedRoutines, error, onConfirm, onClose, isPending,
}: DeleteConfirmDialogProps) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-overlay backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
        <div className="w-full max-w-xs rounded-2xl bg-surface shadow-2xl p-6 flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-full bg-danger-surface flex items-center justify-center">
            <svg className="w-6 h-6 text-danger-text" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-fg-primary">{message}</p>
          {itemName && (
            <p className="text-xs text-fg-secondary truncate max-w-full">{itemName}</p>
          )}
          {affectedRoutines && affectedRoutines.length > 0 && (
            <p className="text-xs text-warning-text">{t('favorites.delete_used_in', { names: affectedRoutines.join(', ') })}</p>
          )}
        </div>
        {error && (
          <p className="rounded-md bg-danger-surface px-3 py-2 text-sm text-danger-text">{error}</p>
        )}
        <div className="flex flex-col gap-2">
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="w-full rounded-xl bg-danger py-2.5 text-sm font-semibold text-danger-fg hover:bg-danger-soft disabled:opacity-50 transition-colors inline-flex items-center justify-center"
          >
            {isPending ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : t('common.delete')}
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-xl py-2.5 text-sm text-fg-secondary hover:bg-surface-subtle transition-colors"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

