import { Outlet, useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';

export default function OnboardingLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="text-lg font-bold text-indigo-600">ArtiCalorias</span>
          <div className="flex items-center">
            <button
              onClick={handleLogout}
              className="rounded-md px-2.5 py-1.5 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
