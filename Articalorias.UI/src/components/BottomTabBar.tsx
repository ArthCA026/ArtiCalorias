import { NavLink } from 'react-router';

interface TabItem {
  to: string;
  label: string;
  isCenter?: boolean;
  icon: React.ReactElement;
}

const tabs: TabItem[] = [
  {
    to: '/history',
    label: 'History',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    to: '/activities',
    label: 'Activities',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    to: '/today',
    label: 'Today',
    isCenter: true,
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>
    ),
  },
  {
    to: '/profile',
    label: 'Profile',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 7h-9" />
        <path d="M14 17H5" />
        <circle cx="17" cy="17" r="3" />
        <circle cx="7" cy="7" r="3" />
      </svg>
    ),
  },
];

export default function BottomTabBar() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-gray-200 bg-white"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-end justify-around h-14">
        {tabs.map((tab) =>
          tab.isCenter ? (
            <NavLink
              key={tab.to}
              to={tab.to}
              className="flex flex-col items-center flex-1 -translate-y-3"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                        : 'bg-indigo-50 text-indigo-400 shadow-sm'
                    }`}
                  >
                    {tab.icon}
                  </span>
                  <span
                    className={`mt-0.5 text-[10px] font-semibold transition-colors ${
                      isActive ? 'text-indigo-600' : 'text-gray-400'
                    }`}
                  >
                    {tab.label}
                  </span>
                </>
              )}
            </NavLink>
          ) : (
            <NavLink
              key={tab.to}
              to={tab.to}
              className="flex flex-col items-center flex-1 py-2"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`transition-colors ${
                      isActive ? 'text-indigo-600' : 'text-gray-400'
                    }`}
                  >
                    {tab.icon}
                  </span>
                  <span
                    className={`mt-1 text-[10px] font-medium transition-colors ${
                      isActive ? 'text-indigo-600' : 'text-gray-500'
                    }`}
                  >
                    {tab.label}
                  </span>
                </>
              )}
            </NavLink>
          )
        )}
      </div>
    </nav>
  );
}
