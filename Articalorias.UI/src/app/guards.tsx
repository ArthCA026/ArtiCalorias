import { Navigate, Outlet, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { profileService } from '@/services/profileService';
import { consentService } from '@/services/consentService';
import { queryKeys } from '@/lib/queryKeys';
import { isNotFound } from '@/utils/apiError';
import { Spinner } from '@/components/ui/Button';

/** Full-screen splash while a guard is deciding. Never a blank screen. */
export function GuardSplash() {
  const { t } = useTranslation();
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-3 text-ink-2">
      <Spinner size={26} />
      <p className="text-sm font-medium">{t('common.loading', 'Loading')}</p>
    </div>
  );
}

/** Requires a signed-in user; used by /onboarding. */
export function RequireAuth() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/**
 * Requires a signed-in user with a completed onboarding.
 * Uses the shared profile query (cached) instead of ad hoc fetches,
 * so navigation does not trigger extra network calls.
 */
export function RequireOnboarded() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: () =>
      profileService
        .get()
        .then((r) => r.data)
        .catch((err) => {
          if (isNotFound(err)) return null; // no profile yet: onboarding needed
          throw err;
        }),
    staleTime: 10 * 60 * 1000,
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (profileQuery.isLoading) return <GuardSplash />;
  if (profileQuery.isError) {
    // Network trouble: let the app render; pages show their own error states.
    return <Outlet />;
  }
  const profile = profileQuery.data;
  if (!profile || !profile.isOnboardingCompleted) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

/**
 * Requires a signed-in user with all consents granted at the current policy
 * versions (Ley 8968). Existing accounts and users caught by a policy version
 * bump are funneled to /consent before anything else, onboarding included.
 * The backend middleware independently blocks writes, so a network error here
 * fails open for UX without weakening enforcement.
 */
export function RequireConsented() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  const consentQuery = useQuery({
    queryKey: queryKeys.consent(),
    queryFn: () => consentService.getState().then((r) => r.data),
    staleTime: 10 * 60 * 1000,
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (consentQuery.isLoading) return <GuardSplash />;
  if (consentQuery.isError) {
    // Network trouble: let the app render; pages show their own error states.
    return <Outlet />;
  }
  if ((consentQuery.data?.requiresConsent.length ?? 0) > 0) {
    return <Navigate to="/consent" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

/** Auth pages: signed-in users go straight to the app. */
export function PublicOnly() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/today" replace />;
  return <Outlet />;
}
