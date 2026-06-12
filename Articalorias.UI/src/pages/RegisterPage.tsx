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
import PasswordCreateField from "@/components/PasswordCreateField";
import ConfirmPasswordField from "@/components/ConfirmPasswordField";
import { validatePassword, validateConfirmPassword } from "@/utils/passwordValidation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldTouched {
  username: boolean;
  email: boolean;
  password: boolean;
  confirmPassword: boolean;
}

export default function RegisterPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<FieldTouched>({ username: false, email: false, password: false, confirmPassword: false });

  const usernameError = !username.trim() ? t('auth.register.username_error_empty') : username.trim().length < 3 ? t('auth.register.username_error_short') : null;
  const emailError = !email.trim() ? t('auth.register.email_error_empty') : !EMAIL_RE.test(email.trim()) ? t('auth.register.email_error_invalid') : null;
  const passwordError = validatePassword(password);
  const confirmError = validateConfirmPassword(password, confirmPassword);

  function markTouched(field: keyof FieldTouched) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  function showError(field: keyof FieldTouched, error: string | null): boolean {
    return !!(error && (submitted || touched[field]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setSubmitted(true);
    setServerError(null);

    if (usernameError || emailError || passwordError || confirmError) return;

    setLoading(true);
    try {
      const { data } = await authService.register({ username, email, password });
      login(data);
      navigate("/today", { replace: true });
    } catch (err) {
      setServerError(extractApiError(err, t('auth.register.server_error')));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate aria-busy={loading}>
      <AuthCard
        title={t('auth.register.title')}
        subtitle={t('auth.register.subtitle')}
        alerts={serverError && <AlertBanner>{serverError}</AlertBanner>}
      >
        <FormField
          id="reg-username"
          label={t('auth.register.username_label')}
          autoComplete="username"
          value={username}
          onChange={setUsername}
          onBlur={() => markTouched("username")}
          error={usernameError}
          showError={showError("username", usernameError)}
          hint={t('auth.register.username_hint')}
        />

        <FormField
          id="reg-email"
          label={t('auth.register.email_label')}
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          onBlur={() => markTouched("email")}
          error={emailError}
          showError={showError("email", emailError)}
          hint={t('auth.register.email_hint')}
        />

        <PasswordCreateField
          id="reg-password"
          value={password}
          onChange={setPassword}
          touched={touched.password}
          onBlur={() => markTouched("password")}
          submitted={submitted}
        />

        <ConfirmPasswordField
          id="reg-confirm"
          password={password}
          value={confirmPassword}
          onChange={setConfirmPassword}
          touched={touched.confirmPassword}
          onBlur={() => markTouched("confirmPassword")}
          submitted={submitted}
        />

        <SubmitButton loading={loading} text={t('auth.register.submit')} loadingText={t('auth.register.submitting')} />
      </AuthCard>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        {t('auth.register.have_account')}{" "}
        <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">{t('auth.register.sign_in')}</Link>
      </p>
    </form>
  );
}
