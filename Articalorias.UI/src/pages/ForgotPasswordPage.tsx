import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { authService } from "@/services/authService";
import { extractApiError, extractApiErrorCode } from "@/utils/apiError";
import { validateEmail } from "@/utils/emailValidation";
import AuthCard from "@/components/auth/AuthCard";
import AlertBanner from "@/components/auth/AlertBanner";
import FormField from "@/components/auth/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import SuccessCard from "@/components/auth/SuccessCard";
import { EmailIcon } from "@/components/auth/icons";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState(false);

  const emailError = validateEmail(email);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setSubmitted(true);
    setServerError(null);

    if (emailError) return;

    setLoading(true);
    try {
      await authService.forgotPassword({ email });
      setSent(true);
    } catch (err) {
      const code = extractApiErrorCode(err);
      if (code === "RESEND_COOLDOWN") {
        setServerError(t('auth.forgot_password.cooldown_error'));
      } else {
        setServerError(extractApiError(err, t('auth.forgot_password.server_error')));
      }
    } finally {
      setLoading(false);
    }
  }

  function handleResend() {
    setSent(false);
    setSubmitted(false);
  }

  /* ── Sent confirmation ─────────────────────────────────────────── */

  if (sent) {
    return (
      <SuccessCard
        icon={<EmailIcon />}
        iconBg="bg-indigo-100"
        title={t('auth.forgot_password.sent_title')}
        description={t('auth.forgot_password.sent_description')}
        footer={
          <p className="text-center text-sm text-gray-500">
            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">{t('auth.forgot_password.back_to_login')}</Link>
          </p>
        }
      >
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {t('auth.forgot_password.sent_spam_before')} <strong className="font-medium text-gray-500">{t('auth.forgot_password.sent_spam_spam')}</strong> {t('auth.forgot_password.sent_spam_or')} <strong className="font-medium text-gray-500">{t('auth.forgot_password.sent_spam_promotions')}</strong> {t('auth.forgot_password.sent_spam_after')}
        </p>

        <Link
          to="/reset-password"
          className="block w-full rounded-md bg-indigo-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          {t('auth.forgot_password.enter_code')}
        </Link>
        <button
          type="button"
          onClick={handleResend}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          {t('auth.forgot_password.resend')}
        </button>
      </SuccessCard>
    );
  }

  /* ── Form ───────────────────────────────────────────────────────── */

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate aria-busy={loading}>
      <AuthCard
        title={t('auth.forgot_password.title')}
        subtitle={t('auth.forgot_password.subtitle')}
        alerts={serverError && <AlertBanner>{serverError}</AlertBanner>}
      >
        <FormField
          id="forgot-email"
          label={t('auth.forgot_password.email_label')}
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          onBlur={() => setTouched(true)}
          error={emailError}
          showError={!!(emailError && (submitted || touched))}
          hint={t('auth.forgot_password.email_hint')}
        />

        <SubmitButton loading={loading} text={t('auth.forgot_password.submit')} loadingText={t('auth.forgot_password.submitting')} />
      </AuthCard>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        {t('auth.forgot_password.remember_password')}{" "}
        <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">{t('auth.forgot_password.sign_in')}</Link>
      </p>
    </form>
  );
}
