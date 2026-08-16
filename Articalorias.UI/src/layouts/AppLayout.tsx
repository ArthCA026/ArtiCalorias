import { Outlet } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AppTabBar } from '@/components/AppTabBar';
import { LogSheetProvider } from '@/components/log/LogSheetContext';
import { Spinner } from '@/components/ui/Button';
import { useHeartbeat } from '@/hooks/useHeartbeat';

/**
 * Shell for the four main tabs. Single-column, one-handed layout:
 * content is a phone-width column, primary actions live at the bottom.
 */
export default function AppLayout() {
  const { t } = useTranslation();
  // Presence ping. When the user returns after days away, the first render
  // briefly waits for it so today's row is created with auto-add re-armed.
  const heartbeatReady = useHeartbeat();

  if (!heartbeatReady) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 text-ink-2">
        <Spinner size={26} />
        <p className="text-sm font-medium">{t('common.loading', 'Loading')}</p>
      </div>
    );
  }

  return (
    <LogSheetProvider>
      <main className="mx-auto max-w-md px-4 pt-4 pb-32">
        <Outlet />
      </main>
      <AppTabBar />
    </LogSheetProvider>
  );
}
