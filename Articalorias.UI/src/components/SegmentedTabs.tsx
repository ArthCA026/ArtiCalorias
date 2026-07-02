import type { ReactNode } from 'react';

interface TabItem {
  key: string;
  label: string;
  /** Optional icon node. Should already carry its own size class (e.g. className="w-3.5 h-3.5"). */
  icon?: ReactNode;
  /** Badge count shown next to the label. Only rendered when > 0. */
  count?: number;
}

interface SegmentedTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (key: string) => void;
  /**
   * - "pill"  — gray pill container, flex-1 label-only buttons (FavoritesPage style).
   * - "icon"  — no container, icon + label + optional count badge (DailyLog style).
   */
  variant?: 'pill' | 'icon';
}

/**
 * Tab-switcher used in FavoritesPage (pill variant) and DailyLogWorkspace (icon variant).
 */
export function SegmentedTabs({
  tabs,
  activeTab,
  onChange,
  variant = 'pill',
}: SegmentedTabsProps) {
  if (variant === 'pill') {
    return (
      <div className="flex gap-1 rounded-xl bg-surface-subtle p-1">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-surface-raised text-fg-primary shadow-sm'
                : 'text-fg-secondary hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  // variant === 'icon'
  return (
    <div className="flex items-center gap-1">
      {tabs.map(({ key, label, icon, count }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          aria-pressed={activeTab === key}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-soft ${
            activeTab === key
              ? 'bg-input-bg text-accent-active shadow-sm ring-1 ring-border'
              : 'text-fg-secondary hover:text-gray-700 dark:hover:text-gray-200 hover:bg-surface-raised/60'
          }`}
        >
          {icon}
          {label}
          {count != null && count > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                activeTab === key
                  ? 'bg-accent-muted text-accent-active'
                  : 'bg-border text-fg-secondary'
              }`}
            >
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
