import { useTranslation } from 'react-i18next';
import { IconSpinner } from '@/components/icons';

interface ModalFormActionsProps {
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
  saveDisabled?: boolean;
  formError?: string | null;
  /** When true, save button fills available width (flex-1). */
  fullWidthSave?: boolean;
}

/**
 * Save / Cancel button row with optional form error paragraph.
 * Renders the error before the buttons when formError is set.
 */
export function ModalFormActions({
  onSave,
  onCancel,
  isPending,
  saveDisabled,
  formError,
  fullWidthSave,
}: ModalFormActionsProps) {
  const { t } = useTranslation();

  return (
    <>
      {formError && (
        <p className="text-sm text-danger-text" role="alert">
          {formError}
        </p>
      )}
      <div className="flex gap-2 pt-2">
        <button
          onClick={onSave}
          disabled={isPending || saveDisabled}
          className={`${fullWidthSave ? 'flex-1 inline-flex items-center justify-center gap-2 ' : ''}rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg hover:bg-accent-soft disabled:opacity-50 transition-colors`}
        >
          {isPending ? <IconSpinner className="w-4 h-4" /> : t('common.save')}
        </button>
        <button
          onClick={onCancel}
          className="rounded-xl px-4 py-2.5 text-sm text-fg-secondary hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {t('common.cancel')}
        </button>
      </div>
    </>
  );
}
