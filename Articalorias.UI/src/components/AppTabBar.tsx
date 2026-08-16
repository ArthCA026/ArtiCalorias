import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useHaptics } from '@/hooks/useHaptics';

interface TabDef {
  to: string;
  icon: IconName;
  labelKey: string;
  fallback: string;
  /** Anchor id for the first-run tour spotlight */
  tourId?: string;
}

const tabs: TabDef[] = [
  { to: '/today', icon: 'home', labelKey: 'tabs.today', fallback: 'Today' },
  { to: '/templates', icon: 'bookmark', labelKey: 'tabs.templates', fallback: 'Templates', tourId: 'tab-templates' },
  { to: '/progress', icon: 'chart', labelKey: 'tabs.progress', fallback: 'Progress', tourId: 'tab-progress' },
  { to: '/profile', icon: 'user', labelKey: 'tabs.profile', fallback: 'Profile' },
];

function TabButton({ tab }: { tab: TabDef }) {
  const { t } = useTranslation();
  const haptics = useHaptics();
  return (
    <NavLink
      to={tab.to}
      data-tour={tab.tourId}
      onClick={() => haptics.tap()}
      className="pressable flex items-center justify-center"
      style={{ width: 72, height: 48 }}
    >
      {({ isActive }) => (
        <span
          className={cn(
            'flex flex-col items-center gap-0.5 transition-colors',
            isActive ? 'text-primary' : 'text-ink-3',
          )}
        >
          <Icon name={tab.icon} size={23} strokeWidth={isActive ? 2.4 : 2} />
          <span className="text-[10px] font-semibold leading-none">{t(tab.labelKey, tab.fallback)}</span>
        </span>
      )}
    </NavLink>
  );
}

/**
 * Bottom navigation: four 72x48 destinations. The primary action is not
 * here anymore; each page shows its own labeled floating button
 * ("Log", "New") so the action always matches the screen.
 */
export function AppTabBar() {
  const { t } = useTranslation();
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-tabbar pb-safe"
      aria-label={t('tabs.nav_aria', 'Main navigation')}
    >
      <div className="mx-auto max-w-md flex items-center justify-around px-2 pt-1.5 pb-1.5">
        {tabs.map((tab) => (
          <TabButton key={tab.to} tab={tab} />
        ))}
      </div>
    </nav>
  );
}
