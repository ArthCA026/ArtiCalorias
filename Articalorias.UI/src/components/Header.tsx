import { NavLink, useNavigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import type { ReactElement } from 'react';

const navItems = [
  { to: '/today', labelKey: 'nav.today' },
  { to: '/history', labelKey: 'nav.history' },
  { to: '/favorites', labelKey: 'nav.favorites' },
  { to: '/profile', labelKey: 'nav.profile' },
  { to: '/settings', labelKey: 'nav.settings_wip' },
];

const PAGE_TITLE_KEYS: { path: string; labelKey: string }[] = [
  { path: '/history', labelKey: 'nav.history' },
  { path: '/favorites', labelKey: 'nav.favorites' },
  { path: '/profile', labelKey: 'nav.profile' },
  { path: '/settings', labelKey: 'nav.settings' },
];

const PAGE_ICONS: Record<string, ReactElement> = {
  '/history': (
    <svg className="h-[15px] w-[15px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  '/favorites': (
    <svg className="h-[15px] w-[15px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2" />
      <polygon points="12,4 13.2,7.4 16.8,7.5 13.9,9.6 15,13 12,11 9,13 10.1,9.6 7.2,7.5 10.8,7.4" />
      <line x1="5" y1="16.5" x2="19" y2="16.5" />
      <line x1="5" y1="19.5" x2="14" y2="19.5" />
    </svg>
  ),
  '/profile': (
    <svg className="h-[15px] w-[15px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  '/settings': (
    <svg className="h-[15px] w-[15px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7h-9" /><path d="M14 17H5" /><circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" />
    </svg>
  ),
};

export default function Header() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isToday = location.pathname === '/today' || location.pathname === '/';
  const currentPage = PAGE_TITLE_KEYS.find(({ path }) => location.pathname.startsWith(path));
  const pageTitle = currentPage ? t(currentPage.labelKey) : undefined;
  const pageIcon = currentPage ? PAGE_ICONS[currentPage.path] : null;

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="relative mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        {/* Desktop left slot: logo/title always on the left */}
        <div className="flex-shrink-0">
          {isToday ? (
            <NavLink to="/today" className="hidden md:flex items-center gap-1.5 text-lg font-bold text-indigo-600">
              <svg className="h-[15px] w-[15px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
              </svg>
              ArtiCalorias
            </NavLink>
          ) : (
            <span className="hidden md:flex items-center gap-1.5 text-base font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[200px]">
              {pageIcon}
              {pageTitle ?? ''}
            </span>
          )}
          {/* Mobile invisible spacer to balance the logout button */}
          <div className="md:hidden w-10" aria-hidden="true" />
        </div>

        {/* Mobile-only: title absolutely centered */}
        <div className="md:hidden absolute left-1/2 -translate-x-1/2">
          {isToday ? (
            <NavLink to="/today" className="flex items-center gap-1.5 text-lg font-bold text-indigo-600 whitespace-nowrap">
              <svg className="h-[15px] w-[15px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
              </svg>
              ArtiCalorias
            </NavLink>
          ) : (
            <span className="flex items-center gap-1.5 text-base font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
              {pageIcon}
              {pageTitle ?? ''}
            </span>
          )}
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                }`
              }
            >
              {t(item.labelKey)}
            </NavLink>
          ))}

          <div className="ml-3 flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-3">
            <span className="text-xs text-gray-400 dark:text-gray-500">{user?.username}</span>
            <button
              onClick={handleLogout}
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              {t('nav.logout')}
            </button>
          </div>
        </nav>

        {/* Mobile Logout Button */}
        <button
          onClick={handleLogout}
          className="md:hidden rounded-md p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors shrink-0"
          aria-label={t('nav.logout')}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </header>
  );
}
