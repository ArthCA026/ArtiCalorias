import type { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  compact?: boolean;
  variant?: 'default' | 'primary' | 'muted';
  headerAction?: ReactNode;
  children: ReactNode;
}

/**
 * Titled section card used across DayDashboard and HistoryPage.
 * Canonical border for the primary variant: dark:border-indigo-800.
 */
export function SectionCard({
  title,
  subtitle,
  icon,
  compact,
  variant,
  headerAction,
  children,
}: SectionCardProps) {
  const sectionClass =
    variant === 'primary'
      ? 'rounded-xl border-2 border-accent-border bg-surface shadow-md ring-1 ring-accent-ring'
      : variant === 'muted'
        ? 'rounded-xl border border-surface-subtle bg-surface-muted shadow-none'
        : 'rounded-xl border border-border bg-surface shadow-sm';

  const titleClass =
    variant === 'primary'
      ? 'text-sm font-bold uppercase tracking-wide text-accent-text'
      : variant === 'muted'
        ? 'text-xs font-semibold uppercase tracking-wide text-fg-subtle'
        : 'text-sm font-semibold uppercase tracking-wide text-fg-secondary';

  return (
    <section className={`${sectionClass} ${compact ? 'p-3 sm:p-3.5' : 'p-4 sm:p-5'}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          {icon && <span className="text-accent-soft flex-shrink-0">{icon}</span>}
          <h2 className={titleClass}>{title}</h2>
        </div>
        {headerAction && <div className="flex items-center">{headerAction}</div>}
      </div>
      {subtitle && <p className="mb-3 text-xs text-fg-subtle">{subtitle}</p>}
      {!subtitle && <div className="mb-2" />}
      {children}
    </section>
  );
}
