import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";
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
        setServerError("You've already requested a code recently. Please wait a minute before trying again.");
      } else {
        setServerError(extractApiError(err, "We couldn't process your request right now. Please try again."));
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
        title="Check your inbox"
        description="If an account exists for this email, we've sent a 6-digit reset code. It may take a minute to arrive."
        footer={
          <p className="text-center text-sm text-gray-500">
            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">Back to sign in</Link>
          </p>
        }
      >
        <p className="text-xs text-gray-400">
          Don't see it? Check your <strong className="font-medium text-gray-500">spam</strong> or <strong className="font-medium text-gray-500">promotions</strong> folder. The code expires in 15 minutes.
        </p>

        <Link
          to="/reset-password"
          className="block w-full rounded-md bg-indigo-600 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          Enter reset code
        </Link>
        <button
          type="button"
          onClick={handleResend}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Didn't receive it? Send again
        </button>
      </SuccessCard>
    );
  }

  /* ── Form ───────────────────────────────────────────────────────── */

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate aria-busy={loading}>
      <AuthCard
        title="Forgot your password?"
        subtitle="No worries — enter your email and we'll send you a 6-digit code to reset it. The code expires after 15 minutes."
        alerts={serverError && <AlertBanner>{serverError}</AlertBanner>}
      >
        <FormField
          id="forgot-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          onBlur={() => setTouched(true)}
          error={emailError}
          showError={!!(emailError && (submitted || touched))}
          hint="The email you used when creating your account"
        />

        <SubmitButton loading={loading} text="Send reset code" loadingText="Sending…" />
      </AuthCard>

      <p className="text-center text-sm text-gray-500">
        Remember your password?{" "}
        <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">Sign in</Link>
      </p>
    </form>
  );
}
