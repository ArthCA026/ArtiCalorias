import { useState, useEffect, useRef } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
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
  if (!raw) return "Please enter your 6-digit reset code.";
  if (!/^\d+$/.test(raw)) return "The code should only contain numbers.";
  if (raw.length < CODE_LENGTH) return "The code must be 6 digits — check your email.";
  return null;
}

export default function ResetPasswordPage() {
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
  const codeError = validateCode(code);
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
        setServerError("You've already requested a code recently. Please wait a minute before trying again.");
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        setServerError("We couldn't resend the code right now. Please try again.");
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
          setServerError("That code has expired. Request a new one below.");
          break;
        case "CODE_INVALID":
          setServerError("That code doesn't match. Please check and try again.");
          break;
        case "TOO_MANY_ATTEMPTS":
          setLockedOut(true);
          setServerError("Too many failed attempts. Please request a new code to continue.");
          setCode("");
          break;
        default:
          setServerError(extractApiError(err, "Something went wrong. Please try again."));
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
        title="Password updated"
        description="Your password has been reset successfully. You can now sign in with your new password."
      >
        <button
          onClick={() => navigate("/login", { replace: true })}
          className="w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          Sign in now
        </button>
        <p className="text-xs text-gray-400">Redirecting in {countdown}s…</p>
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
              {resending ? "Sending…" : resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : "Request a new code →"}
            </button>
          )}
        </AlertBanner>
      )}
    </>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate aria-busy={loading}>
      <AuthCard
        title="Reset your password"
        subtitle="Enter the 6-digit code from your email and choose a new password."
        alerts={alerts}
      >
        <FormField
          id="reset-email"
          label="Email"
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
          label="Reset code"
          value={code}
          onChange={setCode}
          length={CODE_LENGTH}
          disabled={loading}
          error={codeError}
          showError={showError("code", codeError)}
          helperText="Enter the 6-digit code from your email. It expires after 15 minutes."
          onBlur={() => markTouched("code")}
        />

        <PasswordCreateField
          id="reset-password"
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          touched={touched.password}
          onBlur={() => markTouched("password")}
          submitted={submitted}
        />

        <ConfirmPasswordField
          id="reset-confirm"
          label="Confirm new password"
          password={newPassword}
          value={confirmPassword}
          onChange={setConfirmPassword}
          touched={touched.confirmPassword}
          onBlur={() => markTouched("confirmPassword")}
          submitted={submitted}
        />

        <div className="space-y-3">
          <SubmitButton loading={loading} text="Update password" loadingText="Updating password…" />
          <p className="text-center text-xs text-gray-400">
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
            {resending ? "Sending…" : resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
          </button>
          <span className="text-gray-300">·</span>
          <Link to="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
            Use a different email
          </Link>
        </div>
      </AuthCard>

      <p className="text-center text-sm text-gray-500">
        <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">Back to sign in</Link>
      </p>
    </form>
  );
}
