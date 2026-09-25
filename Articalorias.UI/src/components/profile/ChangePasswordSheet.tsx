import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { PasswordField } from '@/components/ui/Field';
import type { ChangePasswordRequest } from '@/types';

interface ChangePasswordSheetProps {
  open: boolean;
  onClose: () => void;
  saving: boolean;
  /** Server-side verdict on the current password, shown under that field. */
  currentPasswordError?: string | null;
  onSave: (data: ChangePasswordRequest) => void;
}

const MIN_LENGTH = 8;

/** The form lives in a child so its state resets whenever the sheet closes. */
export function ChangePasswordSheet({ open, onClose, ...form }: ChangePasswordSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet open={open} onClose={onClose} title={t('profile.change_password_title', 'Change password')}>
      <ChangePasswordForm {...form} />
    </Sheet>
  );
}

type ChangePasswordFormProps = Omit<ChangePasswordSheetProps, 'open' | 'onClose'>;

function ChangePasswordForm({ saving, currentPasswordError, onSave }: ChangePasswordFormProps) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; repeat?: string }>({});

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    const nextErrors: typeof errors = {};
    if (current.length === 0) nextErrors.current = t('profile.password_required', 'Enter your password to continue.');
    if (next.length < MIN_LENGTH) nextErrors.next = t('auth.common.password_min_hint', 'At least 8 characters.');
    else if (next === current) nextErrors.next = t('profile.password_same', 'Choose a password you have not used here before.');
    if (repeat !== next) nextErrors.repeat = t('profile.password_mismatch', 'The passwords do not match.');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSave({ currentPassword: current, newPassword: next });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <p className="text-[15px] text-ink-2 leading-relaxed">
        {t('profile.change_password_body', 'Your other devices are signed out once the password changes. This one stays signed in.')}
      </p>
      <PasswordField
        id="change-password-current"
        name="current-password"
        label={t('profile.change_password_current', 'Current password')}
        autoComplete="current-password"
        showLabel={t('auth.common.show_password', 'Show password')}
        hideLabel={t('auth.common.hide_password', 'Hide password')}
        value={current}
        onChange={(e) => {
          setCurrent(e.target.value);
          setErrors((prev) => ({ ...prev, current: undefined }));
        }}
        error={errors.current ?? currentPasswordError ?? null}
      />
      <PasswordField
        id="change-password-new"
        name="new-password"
        label={t('profile.change_password_new', 'New password')}
        autoComplete="new-password"
        showLabel={t('auth.common.show_password', 'Show password')}
        hideLabel={t('auth.common.hide_password', 'Hide password')}
        hint={t('auth.common.password_min_hint', 'At least 8 characters.')}
        value={next}
        onChange={(e) => {
          setNext(e.target.value);
          setErrors((prev) => ({ ...prev, next: undefined }));
        }}
        error={errors.next}
      />
      <PasswordField
        id="change-password-repeat"
        name="new-password-repeat"
        label={t('profile.change_password_repeat', 'Repeat new password')}
        autoComplete="new-password"
        showLabel={t('auth.common.show_password', 'Show password')}
        hideLabel={t('auth.common.hide_password', 'Hide password')}
        value={repeat}
        onChange={(e) => {
          setRepeat(e.target.value);
          setErrors((prev) => ({ ...prev, repeat: undefined }));
        }}
        error={errors.repeat}
      />
      <Button type="submit" variant="primary" size="lg" fullWidth loading={saving}>
        {t('profile.change_password_save', 'Update password')}
      </Button>
    </form>
  );
}
