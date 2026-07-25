import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';
import { cn } from '@/utils/cn';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  /** Teach the user what to do next, never just "nothing here" */
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  children?: ReactNode;
}

/** Empty screens teach. Icon + what this area is for + how to fill it. */
export function EmptyState({ icon, title, body, actionLabel, onAction, className, children }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center text-center px-6 py-10', className)}>
      <div className="w-14 h-14 rounded-2xl bg-primary-soft text-primary-soft-ink flex items-center justify-center mb-4">
        <Icon name={icon} size={26} />
      </div>
      <p className="text-base font-bold text-ink">{title}</p>
      <p className="mt-1.5 text-sm text-ink-2 max-w-[17rem] leading-relaxed">{body}</p>
      {actionLabel && onAction && (
        <Button variant="soft" size="md" className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
      {children}
    </div>
  );
}

interface ErrorStateProps {
  /** What happened */
  title: string;
  /** What the user can do about it */
  body: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

/** Errors explain what happened and what the user can do about it. */
export function ErrorState({ title, body, retryLabel, onRetry, className, compact }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center text-center rounded-card bg-card',
        compact ? 'px-4 py-5' : 'px-6 py-8',
        className,
      )}
    >
      <div className="w-11 h-11 rounded-2xl bg-danger-soft text-danger flex items-center justify-center mb-3">
        <Icon name="alertTriangle" size={22} />
      </div>
      <p className="text-[15px] font-bold text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-2 max-w-[18rem] leading-relaxed">{body}</p>
      {retryLabel && onRetry && (
        <Button variant="secondary" size="sm" icon="refresh" className="mt-4" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

/** Inline error line for forms: message + optional hint on how to fix. */
export function InlineError({ message, className }: { message: string; className?: string }) {
  return (
    <p role="alert" className={cn('flex items-start gap-1.5 text-[13px] text-danger mt-1.5', className)}>
      <Icon name="alertCircle" size={15} className="mt-px shrink-0" />
      <span>{message}</span>
    </p>
  );
}
