import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { PasswordField } from '@/components/ui/Field';

interface PasswordConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Explain the consequence, especially what will be lost */
  body: string;
  confirmLabel: string;
  loading?: boolean;
  /** Server-side verdict on the password (wrong, locked out) shown under the field. */
  error?: string | null;
  onConfirm: (password: string) => void;
}

/**
 * Confirmation for irreversible account actions. Unlike ConfirmSheet it asks
 * for the current password, which the API requires for these endpoints: a
 * session token alone (one XSS away in a browser) must not be able to erase
 * an account. The form lives in a child so its state resets whenever the
 * sheet closes (Sheet unmounts its children).
 */
export function PasswordConfirmSheet({ open, onClose, title, ...form }: PasswordConfirmSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <PasswordConfirmForm onClose={onClose} {...form} />
    </Sheet>
  );
}

type PasswordConfirmFormProps = Omit<PasswordConfirmSheetProps, 'open' | 'title'>;

function PasswordConfirmForm({ onClose, body, confirmLabel, loading = false, error, onConfirm }: PasswordConfirmFormProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    if (password.length === 0) {
      setLocalError(t('profile.password_required', 'Enter your password to continue.'));
      return;
    }
    setLocalError(null);
    onConfirm(password);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p className="text-[15px] text-ink-2 leading-relaxed">{body}</p>
      <div className="mt-4">
        <PasswordField
          id="confirm-password"
          name="current-password"
          label={t('profile.password_confirm_label', 'Your password')}
          autoComplete="current-password"
          showLabel={t('auth.common.show_password', 'Show password')}
          hideLabel={t('auth.common.hide_password', 'Hide password')}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setLocalError(null);
          }}
          error={localError ?? error ?? null}
        />
      </div>
      <div className="mt-5 space-y-2.5">
        <Button type="submit" variant="danger" size="lg" fullWidth loading={loading}>
          {confirmLabel}
        </Button>
        <Button type="button" variant="secondary" size="lg" fullWidth onClick={onClose} disabled={loading}>
          {t('common.cancel', 'Cancel')}
        </Button>
      </div>
    </form>
  );
}
