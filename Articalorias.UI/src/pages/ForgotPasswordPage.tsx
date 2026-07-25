import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { InlineError } from '@/components/ui/States';
import { Icon } from '@/components/ui/Icon';
import { authService } from '@/services/authService';
import { extractApiError, extractApiErrorCode } from '@/utils/apiError';
import { validateEmail } from '@/utils/emailValidation';

const RESEND_SECONDS = 60;

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const requestCode = async (): Promise<boolean> => {
    try {
      await authService.forgotPassword({ email: email.trim() });
      return true;
    } catch (err) {
      if (extractApiErrorCode(err) === 'RESEND_COOLDOWN') {
        setApiError(t('auth.forgot.error_cooldown', 'Please wait a minute before asking for another code.'));
      } else {
        setApiError(
          extractApiError(
            err,
            t('auth.forgot.error_fallback', 'Could not send the code. Check your connection and try again.'),
          ),
        );
      }
      return false;
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const invalid = validateEmail(email);
    const error = invalid
      ? email.trim()
        ? t('auth.validation.email_invalid', "That doesn't look like a valid email.")
        : t('auth.validation.email_required', 'Please enter your email address.')
      : null;
    setFieldError(error);
    if (error) return;

    setApiError(null);
    setPending(true);
    const ok = await requestCode();
    setPending(false);
    if (ok) {
      setSent(true);
      setCooldown(RESEND_SECONDS);
    }
  };

  const handleResend = async () => {
    setApiError(null);
    setPending(true);
    const ok = await requestCode();
    setPending(false);
    if (ok) setCooldown(RESEND_SECONDS);
  };

  if (sent) {
    return (
      <Card className="text-center px-6 py-8">
        <div className="w-14 h-14 rounded-2xl bg-primary-soft text-primary-soft-ink flex items-center justify-center mx-auto mb-4">
          <Icon name="checkCircle" size={26} />
        </div>
        <p className="text-base font-bold text-ink">{t('auth.forgot.success_title', 'Check your email')}</p>
        <p className="mt-1.5 text-sm text-ink-2 leading-relaxed">
          {t('auth.forgot.success_body', 'If that email exists, we sent a 6 digit code.')}
        </p>
        {apiError && <InlineError message={apiError} className="justify-center mt-4" />}
        <div className="mt-5 space-y-2.5">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate('/reset-password?email=' + encodeURIComponent(email.trim()))}
          >
            {t('auth.forgot.enter_code', 'Enter the code')}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            loading={pending}
            disabled={cooldown > 0}
            onClick={handleResend}
          >
            {cooldown > 0
              ? t('auth.forgot.resend_wait', 'Resend in {{seconds}}s', { seconds: cooldown })
              : t('auth.forgot.resend', 'Resend code')}
          </Button>
        </div>
        <p className="mt-5 text-sm">
          <Link to="/login" className="text-primary-soft-ink font-semibold">
            {t('auth.forgot.back_to_login', 'Back to sign in')}
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-lg font-bold text-ink">{t('auth.forgot.title', 'Reset your password')}</h2>
        <p className="text-sm text-ink-2 mt-1 mb-4 leading-relaxed">
          {t('auth.forgot.body', 'Enter your email and we will send you a 6 digit code.')}
        </p>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Field
            id="forgot-email"
            name="email"
            label={t('auth.forgot.email_label', 'Email')}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldError(null);
              setApiError(null);
            }}
            error={fieldError}
          />
          <div className="pt-1">
            {apiError && <InlineError message={apiError} className="mb-3" />}
            <Button type="submit" variant="primary" size="lg" fullWidth loading={pending}>
              {t('auth.forgot.submit', 'Send code')}
            </Button>
          </div>
        </form>
      </Card>

      <p className="text-center text-sm pt-1">
        <Link to="/login" className="text-primary-soft-ink font-semibold">
          {t('auth.forgot.back_to_login', 'Back to sign in')}
        </Link>
      </p>
    </div>
  );
}
