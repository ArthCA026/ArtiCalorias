import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Field, PasswordField } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { InlineError } from '@/components/ui/States';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/authService';
import { extractApiError } from '@/utils/apiError';
import { validateEmail } from '@/utils/emailValidation';
import { validatePassword, validateConfirmPassword } from '@/utils/passwordValidation';

interface FieldErrors {
  username?: string;
  email?: string;
  password?: string;
  confirm?: string;
}

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const clearError = (key: keyof FieldErrors) => {
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    setApiError(null);
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!username.trim()) {
      errors.username = t('auth.register.error_username_required', 'Choose a username.');
    } else if (username.trim().length < 3) {
      errors.username = t('auth.register.error_username_short', 'Must be at least 3 characters.');
    }
    if (validateEmail(email)) {
      errors.email = email.trim()
        ? t('auth.validation.email_invalid', "That doesn't look like a valid email.")
        : t('auth.validation.email_required', 'Please enter your email address.');
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
    if (errors.username || errors.email || errors.password || errors.confirm) return;

    setApiError(null);
    setPending(true);
    try {
      const data = await authService
        .register({ username: username.trim(), email: email.trim(), password })
        .then((r) => r.data);
      login(data);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setApiError(
        extractApiError(
          err,
          t('auth.register.error_fallback', 'Could not create your account. Check your connection and try again.'),
        ),
      );
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-bold text-ink mb-4">{t('auth.register.title', 'Create your account')}</h2>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Field
            id="register-username"
            name="username"
            label={t('auth.register.username_label', 'Username')}
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            hint={t('auth.register.username_hint', 'At least 3 characters.')}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              clearError('username');
            }}
            error={fieldErrors.username}
          />
          <Field
            id="register-email"
            name="email"
            label={t('auth.register.email_label', 'Email')}
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
          <PasswordField
            id="register-password"
            name="new-password"
            label={t('auth.register.password_label', 'Password')}
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
            id="register-confirm"
            name="confirm-password"
            label={t('auth.register.confirm_label', 'Confirm password')}
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
              {t('auth.register.submit', 'Create account')}
            </Button>
          </div>
        </form>
      </Card>

      <p className="text-center text-sm text-ink-2 pt-1">
        {t('auth.register.login_prompt', 'Already have an account?')}{' '}
        <Link to="/login" className="text-primary-soft-ink font-semibold">
          {t('auth.register.login_link', 'Sign in')}
        </Link>
      </p>
    </div>
  );
}
