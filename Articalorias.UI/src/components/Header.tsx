import { NavLink, useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { to: '/today', label: 'Today' },
  { to: '/history', label: 'History' },
  { to: '/activities', label: 'Activities' },
  { to: '/profile', label: 'Profile' },
];

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <NavLink to="/today" className="text-lg font-bold text-indigo-600">
          ArtiCalorias
        </NavLink>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}

          <div className="ml-3 flex items-center gap-2 border-l border-gray-200 pl-3">
            <span className="text-xs text-gray-400">{user?.username}</span>
            <button
              onClick={handleLogout}
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              Logout
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}
