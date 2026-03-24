import { Outlet } from 'react-router';

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-indigo-600">ArtiCalorias</h1>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
