import { Outlet } from 'react-router';
import { AppTabBar } from '@/components/AppTabBar';
import { LogSheetProvider } from '@/components/log/LogSheetContext';

/**
 * Shell for the four main tabs. Single-column, one-handed layout:
 * content is a phone-width column, primary actions live at the bottom.
 */
export default function AppLayout() {
  return (
    <LogSheetProvider>
      <main className="mx-auto max-w-md px-4 pt-4 pb-32">
        <Outlet />
      </main>
      <AppTabBar />
    </LogSheetProvider>
  );
}
