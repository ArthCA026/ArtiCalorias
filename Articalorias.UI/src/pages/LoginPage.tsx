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

export default function LoginPage() {
  const { login, sessionExpired, clearSessionExpired } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<{ username: boolean; password: boolean }>({ username: false, password: false });

  const usernameError = !username.trim() ? "Please enter your username." : null;
  const passwordError = !password.trim() ? "Please enter your password." : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setSubmitted(true);
    setServerError(null);
    clearSessionExpired();

    if (usernameError || passwordError) return;

    setLoading(true);
    try {
      const { data } = await authService.login({ username, password });
      login(data);
      navigate("/today", { replace: true });
    } catch (err) {
      setServerError(extractApiError(err, "Incorrect username or password."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate aria-busy={loading}>
      <AuthCard
        title="Welcome back"
        subtitle="Sign in to pick up where you left off."
        alerts={<>
          {sessionExpired && (
            <AlertBanner variant="warning">Your session expired — please sign in again.</AlertBanner>
          )}
          {serverError && <AlertBanner>{serverError}</AlertBanner>}
        </>}
      >
        <FormField
          id="login-username"
          label="Username"
          autoComplete="username"
          value={username}
          onChange={setUsername}
          onBlur={() => setTouched((t) => ({ ...t, username: true }))}
          error={usernameError}
          showError={!!(usernameError && (submitted || touched.username))}
        />

        <FormField
          id="login-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          error={passwordError}
          showError={!!(passwordError && (submitted || touched.password))}
          labelRight={
            <Link to="/forgot-password" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 rounded-sm px-0.5">
              Forgot password?
            </Link>
          }
        />

        <SubmitButton loading={loading} text="Sign in" loadingText="Signing in…" />
      </AuthCard>

      <p className="text-center text-sm text-gray-500">
        Don't have an account?{" "}
        <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-500">Create account</Link>
      </p>
    </form>
  );
}
