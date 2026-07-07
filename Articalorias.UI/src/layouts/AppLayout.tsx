import { useEffect } from 'react';
import { Outlet } from 'react-router';
import Header from '@/components/Header';
import BottomTabBar from '@/components/BottomTabBar';

export default function AppLayout() {
  // Keep --dock-height in sync so Toast can position itself above the dock on mobile.
  // When the dock is display:none (md+), ResizeObserver reports 0 → toast falls back to 80px.
  useEffect(() => {
    const el = document.getElementById('mobile-bottom-dock');
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        document.documentElement.style.setProperty(
          '--dock-height',
          `${Math.ceil(entry.contentRect.height)}px`,
        );
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950 overflow-x-hidden">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-2 pb-24 md:pt-4 md:pb-6 overflow-x-hidden">
        <Outlet />
      </main>
      {/* Mobile bottom dock — LogComposer portals into #composer-portal-slot, BottomTabBar follows */}
      <div
        id="mobile-bottom-dock"
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-[0_-4px_16px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.4)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div id="composer-portal-slot" />
        <BottomTabBar />
      </div>
    </div>
  );
}
