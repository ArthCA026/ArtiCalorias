import { Outlet } from 'react-router';
import type { ReactNode } from 'react';
import { MacroCatalogProvider, useMacros } from '@/hooks/useMacros';
import { GuardSplash } from './guards';

/**
 * Loads the macro catalog once for everything below (onboarding included,
 * since it needs the protein presets). Only the very first fetch blocks
 * rendering; a fetch failure lets the app render with an empty catalog
 * (every consumer falls back gracefully) rather than trapping the user.
 */
function CatalogGate({ children }: { children: ReactNode }) {
  const { isLoading, defs } = useMacros();
  if (isLoading && defs.length === 0) return <GuardSplash />;
  return children;
}

export default function CatalogBoundary() {
  return (
    <MacroCatalogProvider>
      <CatalogGate>
        <Outlet />
      </CatalogGate>
    </MacroCatalogProvider>
  );
}
