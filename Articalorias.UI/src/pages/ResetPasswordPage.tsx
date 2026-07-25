import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Field, PasswordField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { InlineError } from '@/components/ui/States';
import { Icon } from '@/components/ui/Icon';
import { authService } from '@/services/authService';
import { extractApiError, extractApiErrorCode } from '@/utils/apiError';
import { validateEmail } from '@/utils/emailValidation';
import { validatePassword, validateConfirmPassword } from '@/utils/passwordValidation';

const REDIRECT_SECONDS = 5;
const CODE_RE = /^\d{6}$/;

interface FieldErrors {
  email?: string;
  code?: string;
  password?: string;
  confirm?: string;
}

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState(() => searchParams.get('email') ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [seconds, setSeconds] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (!success) return;
    if (seconds <= 0) {
      navigate('/login', { replace: true });
      return;
    }
    const id = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [success, seconds, navigate]);

  const clearError = (key: keyof FieldErrors) => {
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    setApiError(null);
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (validateEmail(email)) {
      errors.email = email.trim()
        ? t('auth.validation.email_invalid', "That doesn't look like a valid email.")
        : t('auth.validation.email_required', 'Please enter your email address.');
    }
    if (!CODE_RE.test(code)) {
      errors.code = t('auth.reset.error_code_format', 'Enter the 6 digit code from your email.');
    }
    if (validatePassword(password)) {
      errors.password = password
        ? t('auth.validation.password_short', 'Must be at least 8 characters.')
        : t('auth.validation.password_required', 'Please enter a password.');
    }
    if (validateConfirmPassword(password, confirm)) {
      errors.confirm = confirm
        ? t('auth.validation.confirm_mismatch', "Passwords don't match.")
        : t('auth.validation.confirm_required', 'Please re-enter your password.');
    }
    return errors;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errors = validate();
    setFieldErrors(errors);
    if (errors.email || errors.code || errors.password || errors.confirm) return;

    setApiError(null);
    setPending(true);
    try {
      await authService.resetPassword({ email: email.trim(), token: code, newPassword: password });
      setSuccess(true);
    } catch (err) {
      const errorCode = extractApiErrorCode(err);
      if (errorCode === 'CODE_EXPIRED') {
        setApiError(t('auth.reset.error_code_expired', 'That code expired. Request a new one.'));
      } else if (errorCode === 'CODE_INVALID') {
        setApiError(t('auth.reset.error_code_invalid', 'That code is not right. Check the email and try again.'));
      } else if (errorCode === 'TOO_MANY_ATTEMPTS') {
        setApiError(t('auth.reset.error_too_many_attempts', 'Too many tries. Wait 15 minutes, then request a new code.'));
      } else {
        setApiError(
          extractApiError(
            err,
            t('auth.reset.error_fallback', 'Could not reset your password. Check your connection and try again.'),
          ),
        );
      }
    } finally {
      setPending(false);
    }
  };

  if (success) {
    return (
      <Card className="text-center px-6 py-8">
        <div className="w-14 h-14 rounded-2xl bg-primary-soft text-primary-soft-ink flex items-center justify-center mx-auto mb-4">
          <Icon name="checkCircle" size={26} />
        </div>
        <p className="text-base font-bold text-ink">{t('auth.reset.success_title', 'Password updated')}</p>
        <p className="mt-1.5 text-sm text-ink-2 leading-relaxed">
          {t('auth.reset.success_body', 'You can now sign in with your new password.')}
        </p>
        <p className="mt-1 text-[13px] text-ink-3">
          {t('auth.reset.redirect_note', 'Taking you to sign in in {{seconds}}s', { seconds })}
        </p>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          className="mt-5"
          onClick={() => navigate('/login', { replace: true })}
        >
          {t('auth.reset.sign_in_now', 'Sign in now')}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-bold text-ink">{t('auth.reset.title', 'Set a new password')}</h2>
        <p className="text-sm text-ink-2 mt-1 mb-4 leading-relaxed">
          {t('auth.reset.body', 'Type the 6 digit code from your email and choose a new password.')}
        </p>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Field
            id="reset-email"
            name="email"
            label={t('auth.reset.email_label', 'Email')}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearError('email');
            }}
            error={fieldErrors.email}
          />
          <Field
            id="reset-code"
            name="code"
            label={t('auth.reset.code_label', '6 digit code')}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]{6}"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
              clearError('code');
            }}
            error={fieldErrors.code}
          />
          <PasswordField
            id="reset-password"
            name="new-password"
            label={t('auth.reset.password_label', 'New password')}
            autoComplete="new-password"
            showLabel={t('auth.common.show_password', 'Show password')}
            hideLabel={t('auth.common.hide_password', 'Hide password')}
            hint={t('auth.common.password_min_hint', 'At least 8 characters.')}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearError('password');
            }}
            error={fieldErrors.password}
          />
          <PasswordField
            id="reset-confirm"
            name="confirm-password"
            label={t('auth.reset.confirm_label', 'Confirm new password')}
            autoComplete="new-password"
            showLabel={t('auth.common.show_password', 'Show password')}
            hideLabel={t('auth.common.hide_password', 'Hide password')}
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              clearError('confirm');
            }}
            error={fieldErrors.confirm}
          />
          <div className="pt-1">
            {apiError && <InlineError message={apiError} className="mb-3" />}
            <Button type="submit" variant="primary" size="lg" fullWidth loading={pending}>
              {t('auth.reset.submit', 'Reset password')}
            </Button>
          </div>
        </form>
      </Card>

      <p className="text-center text-sm text-ink-2 pt-1">
        {t('auth.reset.no_code_prompt', 'Code missing or expired?')}{' '}
        <Link to="/forgot-password" className="text-primary-soft-ink font-semibold">
          {t('auth.reset.request_new_code', 'Request a new code')}
        </Link>
      </p>
    </div>
  );
}
