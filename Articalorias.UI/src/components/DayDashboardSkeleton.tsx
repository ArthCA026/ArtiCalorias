import { useTranslation } from 'react-i18next';
import SkeletonRow from './SkeletonRow';
import SkeletonCard from './SkeletonCard';

interface DayDashboardSkeletonProps {
  /** Additional Tailwind classes applied to the outer wrapper. */
  className?: string;
}

export default function DayDashboardSkeleton({
  className = '',
}: DayDashboardSkeletonProps) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t('common.loading')}
      className={`w-full space-y-4 px-4 pt-4 pb-24 ${className}`}
    >
      {/* Today header */}
      <div className="flex items-center justify-between">
        <SkeletonRow height="h-6" widths={['w-24']} />
        <SkeletonRow height="h-4" widths={['w-16']} />
      </div>

      {/* Summary card — calorie + protein rows */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        {/* Calorie row */}
        <SkeletonRow widths={['w-1/2', 'w-1/4']} height="h-5" />
        {/* Calorie progress bar */}
        <SkeletonRow widths={['w-full']} height="h-2" />
        {/* Protein row */}
        <SkeletonRow widths={['w-2/5', 'w-1/5']} height="h-4" />
        {/* Protein progress bar */}
        <SkeletonRow widths={['w-full']} height="h-2" />
      </div>

      {/* Tab bar — Meals / Activities */}
      <div className="rounded-xl border border-border bg-surface p-1">
        <SkeletonRow widths={['w-1/2', 'w-1/2']} height="h-8" />
      </div>

      {/* Input row */}
      <div className="rounded-xl border border-border bg-surface p-3">
        <SkeletonRow widths={['w-full']} height="h-10" />
      </div>

      {/* Log entry placeholders */}
      <SkeletonCard rows={2} />
      <SkeletonCard rows={2} />
    </div>
  );
}
