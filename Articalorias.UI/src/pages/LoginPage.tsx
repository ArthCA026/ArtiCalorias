import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { Card } from '@/components/ui/Card';
import { Field, PasswordField } from '@/components/ui/Field';
import { Button, IconButton } from '@/components/ui/Button';
import { InlineError } from '@/components/ui/States';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/authService';
import { extractApiError } from '@/utils/apiError';

interface FieldErrors {
  usernameOrEmail?: string;
  password?: string;
}

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, sessionExpired, clearSessionExpired } = useAuth();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errors: FieldErrors = {};
    if (!usernameOrEmail.trim()) {
      errors.usernameOrEmail = t('auth.login.error_empty_username', 'Enter your username or email.');
    }
    if (!password) {
      errors.password = t('auth.login.error_empty_password', 'Enter your password.');
    }
    setFieldErrors(errors);
    if (errors.usernameOrEmail || errors.password) return;

    setApiError(null);
    setPending(true);
    try {
      const data = await authService
        .login({ usernameOrEmail: usernameOrEmail.trim(), password })
        .then((r) => r.data);
      login(data);
      navigate('/today', { replace: true });
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 401) {
        setApiError(
          t('auth.login.error_credentials', 'Wrong username or password. Check your details and try again.'),
        );
      } else {
        setApiError(
          extractApiError(
            err,
            t('auth.login.error_fallback', 'Could not sign you in. Check your connection and try again.'),
          ),
        );
      }
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      {sessionExpired && (
        <Card variant="soft" padded={false} role="status" className="flex items-center gap-2.5 p-3 pl-4">
          <Icon name="info" size={19} className="text-primary-soft-ink shrink-0" />
          <p className="flex-1 text-[13px] font-medium text-primary-soft-ink leading-snug">
            {t('auth.login.session_expired', 'You were signed out for security. Sign in again.')}
          </p>
          <IconButton
            icon="close"
            label={t('auth.login.dismiss', 'Dismiss')}
            size={36}
            iconSize={16}
            className="text-primary-soft-ink"
            onClick={clearSessionExpired}
          />
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-bold text-ink mb-4">{t('auth.login.title', 'Welcome back')}</h2>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Field
            id="login-username"
            name="username"
            label={t('auth.login.username_label', 'Username or email')}
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={usernameOrEmail}
            onChange={(e) => {
              setUsernameOrEmail(e.target.value);
              setFieldErrors((prev) => ({ ...prev, usernameOrEmail: undefined }));
              setApiError(null);
            }}
            error={fieldErrors.usernameOrEmail}
          />
          <PasswordField
            id="login-password"
            name="password"
            label={t('auth.login.password_label', 'Password')}
            autoComplete="current-password"
            showLabel={t('auth.common.show_password', 'Show password')}
            hideLabel={t('auth.common.hide_password', 'Hide password')}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((prev) => ({ ...prev, password: undefined }));
              setApiError(null);
            }}
            error={fieldErrors.password}
          />
          <div className="pt-1">
            {apiError && <InlineError message={apiError} className="mb-3" />}
            <Button type="submit" variant="primary" size="lg" fullWidth loading={pending}>
              {t('auth.login.submit', 'Sign in')}
            </Button>
          </div>
        </form>
      </Card>

      <div className="text-center space-y-2.5 pt-1">
        <p className="text-sm">
          <Link to="/forgot-password" className="text-primary-soft-ink font-semibold">
            {t('auth.login.forgot_link', 'Forgot your password?')}
          </Link>
        </p>
        <p className="text-sm text-ink-2">
          {t('auth.login.register_prompt', 'New here?')}{' '}
          <Link to="/register" className="text-primary-soft-ink font-semibold">
            {t('auth.login.register_link', 'Create an account')}
          </Link>
        </p>
      </div>
    </div>
  );
}
