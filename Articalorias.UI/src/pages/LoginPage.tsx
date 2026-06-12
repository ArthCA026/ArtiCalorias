import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/authService";
import { extractApiError } from "@/utils/apiError";
import AuthCard from "@/components/auth/AuthCard";
import AlertBanner from "@/components/auth/AlertBanner";
import FormField from "@/components/auth/FormField";
import SubmitButton from "@/components/auth/SubmitButton";

export default function LoginPage() {
  const { t } = useTranslation();
  const { login, sessionExpired, clearSessionExpired } = useAuth();
  const navigate = useNavigate();

  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<{ usernameOrEmail: boolean; password: boolean }>({ usernameOrEmail: false, password: false });

  const usernameOrEmailError = !usernameOrEmail.trim() ? t('auth.login.username_error') : null;
  const passwordError = !password.trim() ? t('auth.login.password_error') : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setSubmitted(true);
    setServerError(null);
    clearSessionExpired();

    if (usernameOrEmailError || passwordError) return;

    setLoading(true);
    try {
      const { data } = await authService.login({ usernameOrEmail, password });
      login(data);
      navigate("/today", { replace: true });
    } catch (err) {
      setServerError(extractApiError(err, t('auth.login.server_error')));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate aria-busy={loading}>
      <AuthCard
        title={t('auth.login.title')}
        subtitle={t('auth.login.subtitle')}
        alerts={<>
          {sessionExpired && (
            <AlertBanner variant="warning">{t('auth.login.session_expired')}</AlertBanner>
          )}
          {serverError && <AlertBanner>{serverError}</AlertBanner>}
        </>}
      >
        <FormField
          id="login-username"
          label={t('auth.login.username_label')}
          autoComplete="username"
          value={usernameOrEmail}
          onChange={setUsernameOrEmail}
          onBlur={() => setTouched((t) => ({ ...t, usernameOrEmail: true }))}
          error={usernameOrEmailError}
          showError={!!(usernameOrEmailError && (submitted || touched.usernameOrEmail))}
        />

        <FormField
          id="login-password"
          label={t('auth.login.password_label')}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          error={passwordError}
          showError={!!(passwordError && (submitted || touched.password))}
          showPasswordToggle
          labelRight={
            <Link to="/forgot-password" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 rounded-sm px-0.5">
              {t('auth.login.forgot_password')}
            </Link>
          }
        />

        <SubmitButton loading={loading} text={t('auth.login.submit')} loadingText={t('auth.login.submitting')} />
      </AuthCard>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        {t('auth.login.no_account')}{" "}
        <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">{t('auth.login.create_account')}</Link>
      </p>
      <p className="text-center text-xs text-gray-300 dark:text-gray-600">v1.1.0</p>
    </form>
  );
}
