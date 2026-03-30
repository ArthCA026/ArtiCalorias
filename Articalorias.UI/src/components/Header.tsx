import { NavLink, useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';

const navItems = [
  { to: '/today', label: 'Today' },
  { to: '/history', label: 'History' },
  { to: '/activities', label: 'Activities' },
  { to: '/profile', label: 'Profile' },
];

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <NavLink to="/today" className="text-lg font-bold text-indigo-600 flex-shrink-0">
          ArtiCalorias
        </NavLink>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
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

        {/* Mobile Navigation — only the hamburger button inline */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors flex-shrink-0"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <nav className="px-4 py-2 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}

            <div className="border-t border-gray-200 mt-2 pt-2 flex items-center justify-between">
              <span className="text-xs text-gray-400 truncate">{user?.username}</span>
              <button
                onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                className="rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                Logout
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
