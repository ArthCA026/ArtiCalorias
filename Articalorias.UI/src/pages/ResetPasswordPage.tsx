import { useState, useEffect, useRef } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { authService } from "@/services/authService";
import { extractApiError, extractApiErrorCode } from "@/utils/apiError";
import { validateEmail } from "@/utils/emailValidation";
import AuthCard from "@/components/auth/AuthCard";
import AlertBanner from "@/components/auth/AlertBanner";
import FormField from "@/components/auth/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import SuccessCard from "@/components/auth/SuccessCard";
import SegmentedCodeInput from "@/components/auth/SegmentedCodeInput";
import { CheckIcon } from "@/components/auth/icons";
import PasswordCreateField from "@/components/PasswordCreateField";
import ConfirmPasswordField from "@/components/ConfirmPasswordField";
import { validatePassword, validateConfirmPassword } from "@/utils/passwordValidation";

interface FieldTouched {
  email: boolean;
  code: boolean;
  password: boolean;
  confirmPassword: boolean;
}

const CODE_LENGTH = 6;
const AUTO_REDIRECT_SECONDS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

function validateCode(raw: string): string | null {
  if (!raw) return "code_error_empty";
  if (!/^\d+$/.test(raw)) return "code_error_numbers";
  if (raw.length < CODE_LENGTH) return "code_error_length";
  return null;
}

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [codeExpired, setCodeExpired] = useState(false);
  const [lockedOut, setLockedOut] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_REDIRECT_SECONDS);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<FieldTouched>({ email: false, code: false, password: false, confirmPassword: false });
  const redirectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const emailError = validateEmail(email);
  const codeErrorKey = validateCode(code);
  const codeError = codeErrorKey ? t(`auth.reset_password.${codeErrorKey}`) : null;
  const passwordError = validatePassword(newPassword);
  const confirmError = validateConfirmPassword(newPassword, confirmPassword);

  function markTouched(field: keyof FieldTouched) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  function showError(field: keyof FieldTouched, error: string | null): boolean {
    return !!(error && (submitted || touched[field]));
  }

  /* ── Resend code ───────────────────────────────────────────────── */

  const canResend = !resending && resendCooldown === 0 && !!email.trim() && !emailError;

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function handleResendCode() {
    if (!canResend) return;
    setResending(true);
    setResendSuccess(false);
    setServerError(null);
    setCodeExpired(false);
    setLockedOut(false);
    try {
      await authService.forgotPassword({ email });
      setResendSuccess(true);
      setCode("");
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      const code = extractApiErrorCode(err);
      if (code === "RESEND_COOLDOWN") {
        setServerError(t('auth.reset_password.resend_cooldown_error'));
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        setServerError(t('auth.reset_password.resend_error'));
      }
    } finally {
      setResending(false);
    }
  }

  /* ── Auto-redirect after success ───────────────────────────────── */

  useEffect(() => {
    if (!success) return;
    redirectTimerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (redirectTimerRef.current) clearInterval(redirectTimerRef.current);
          navigate("/login", { replace: true });
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (redirectTimerRef.current) clearInterval(redirectTimerRef.current);
    };
  }, [success, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setSubmitted(true);
    setServerError(null);
    setCodeExpired(false);
    setLockedOut(false);
    setResendSuccess(false);

    if (emailError || codeError || passwordError || confirmError) return;

    setLoading(true);
    try {
      await authService.resetPassword({ email, token: code, newPassword });
      setSuccess(true);
    } catch (err) {
      const errorCode = extractApiErrorCode(err);
      switch (errorCode) {
        case "CODE_EXPIRED":
          setCodeExpired(true);
          setServerError(t('auth.reset_password.code_expired_error'));
          break;
        case "CODE_INVALID":
          setServerError(t('auth.reset_password.code_invalid_error'));
          break;
        case "TOO_MANY_ATTEMPTS":
          setLockedOut(true);
          setServerError(t('auth.reset_password.locked_out_error'));
          setCode("");
          break;
        default:
          setServerError(extractApiError(err, t('auth.reset_password.server_error')));
      }
    } finally {
      setLoading(false);
    }
  }

  /* ── Success view ──────────────────────────────────────────────── */

  if (success) {
    return (
      <SuccessCard
        icon={<CheckIcon />}
        title={t('auth.reset_password.success_title')}
        description={t('auth.reset_password.success_description')}
      >
        <button
          onClick={() => navigate("/login", { replace: true })}
          className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          {t('auth.reset_password.success_signin')}
        </button>
        <p className="text-xs text-gray-400 dark:text-gray-500">{t('auth.reset_password.success_redirect', { count: countdown })}</p>
      </SuccessCard>
    );
  }

  /* ── Form view ─────────────────────────────────────────────────── */

  const alerts = (
    <>
      {resendSuccess && (
        <AlertBanner variant="success">
          A new code has been sent to your email. Any previous code is no longer valid.
        </AlertBanner>
      )}
      {serverError && (
        <AlertBanner variant={codeExpired || lockedOut ? "warning" : "error"}>
          <p>{serverError}</p>
          {(codeExpired || lockedOut) && (
            <button
              type="button"
              onClick={handleResendCode}
              disabled={!canResend}
              className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
            >
              {resending ? t('auth.reset_password.resend_sending') : resendCooldown > 0 ? t('auth.reset_password.resend_cooldown', { count: resendCooldown }) : t('auth.reset_password.resend_request')}
            </button>
          )}
        </AlertBanner>
      )}
    </>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate aria-busy={loading}>
      <AuthCard
        title={t('auth.reset_password.title')}
        subtitle={t('auth.reset_password.subtitle')}
        alerts={alerts}
      >
        <FormField
          id="reset-email"
          label={t('auth.reset_password.email_label')}
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          onBlur={() => markTouched("email")}
          error={emailError}
          showError={showError("email", emailError)}
        />

        <SegmentedCodeInput
          id="reset-code"
          label={t('auth.reset_password.code_label')}
          value={code}
          onChange={setCode}
          length={CODE_LENGTH}
          disabled={loading}
          error={codeError}
          showError={showError("code", codeError)}
          helperText={t('auth.reset_password.code_helper')}
          onBlur={() => markTouched("code")}
        />

        <PasswordCreateField
          id="reset-password"
          label={t('auth.reset_password.new_password_label')}
          value={newPassword}
          onChange={setNewPassword}
          touched={touched.password}
          onBlur={() => markTouched("password")}
          submitted={submitted}
        />

        <ConfirmPasswordField
          id="reset-confirm"
          label={t('auth.reset_password.confirm_password_label')}
          password={newPassword}
          value={confirmPassword}
          onChange={setConfirmPassword}
          touched={touched.confirmPassword}
          onBlur={() => markTouched("confirmPassword")}
          submitted={submitted}
        />

        <div className="space-y-3">
          <SubmitButton loading={loading} text={t('auth.reset_password.submit')} loadingText={t('auth.reset_password.submitting')} />
          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            Your password is encrypted and stored securely.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            onClick={handleResendCode}
            disabled={!canResend}
            className="font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
          >
          {resending ? t('auth.reset_password.resend_sending') : resendCooldown > 0 ? t('auth.reset_password.resend_cooldown', { count: resendCooldown }) : t('auth.reset_password.resend_request')}
          </button>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <Link to="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
            Use a different email
          </Link>
        </div>
      </AuthCard>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">{t('auth.reset_password.back_to_login')}</Link>
      </p>
    </form>
  );
}
