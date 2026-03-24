import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { profileService } from "@/services/profileService";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setChecking(false);
      return;
    }

    // Once confirmed onboarded, skip future network checks
    if (onboarded === true) return;

    setChecking(true);
    let cancelled = false;
    profileService
      .get()
      .then(({ data }) => {
        if (!cancelled) setOnboarded(data.isOnboardingCompleted);
      })
      .catch(() => {
        if (!cancelled) setOnboarded(false);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => { cancelled = true; };
    // Re-check when route changes so post-onboarding navigation works.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, location.pathname]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (checking) {
    return <LoadingSpinner message="Checking profile..." />;
  }

  if (onboarded === false && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
