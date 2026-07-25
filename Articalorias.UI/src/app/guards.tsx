import { Navigate, Outlet, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { profileService } from '@/services/profileService';
import { queryKeys } from '@/lib/queryKeys';
import { isNotFound } from '@/utils/apiError';
import { Spinner } from '@/components/ui/Button';

/** Full-screen splash while a guard is deciding. Never a blank screen. */
function GuardSplash() {
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

/** Auth pages: signed-in users go straight to the app. */
export function PublicOnly() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/today" replace />;
  return <Outlet />;
}
