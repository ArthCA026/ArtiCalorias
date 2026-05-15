import { Outlet } from 'react-router';
import Header from '@/components/Header';
import BottomTabBar from '@/components/BottomTabBar';

export default function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 overflow-x-hidden">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-24 md:py-6 overflow-x-hidden">
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  );
}
