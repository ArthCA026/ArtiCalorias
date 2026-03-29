import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
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

  const usernameError = !username.trim() ? "Please choose a username." : username.trim().length < 3 ? "Must be at least 3 characters." : null;
  const emailError = !email.trim() ? "Please enter your email." : !EMAIL_RE.test(email.trim()) ? "That doesn't look like a valid email." : null;
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
      setServerError(extractApiError(err, "We couldn't create your account. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate aria-busy={loading}>
      <AuthCard
        title="Create account"
        subtitle="It only takes a minute to get started."
        alerts={serverError && <AlertBanner>{serverError}</AlertBanner>}
      >
        <FormField
          id="reg-username"
          label="Username"
          autoComplete="username"
          value={username}
          onChange={setUsername}
          onBlur={() => markTouched("username")}
          error={usernameError}
          showError={showError("username", usernameError)}
          hint="3–50 characters"
        />

        <FormField
          id="reg-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          onBlur={() => markTouched("email")}
          error={emailError}
          showError={showError("email", emailError)}
          hint="Used only for account recovery"
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

        <SubmitButton loading={loading} text="Create account" loadingText="Creating account…" />
      </AuthCard>

      <p className="text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">Sign in</Link>
      </p>
    </form>
  );
}
