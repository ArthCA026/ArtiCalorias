import { useTranslation } from 'react-i18next';
import SkeletonRow from './SkeletonRow';

interface HistoryListSkeletonProps {
  /** Number of skeleton history row items to render. @default 6 */
  rowCount?: number;
  /** Additional Tailwind classes applied to the outer wrapper. */
  className?: string;
}

export default function HistoryListSkeleton({
  rowCount = 6,
  className = '',
}: HistoryListSkeletonProps) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t('history.loading_skeleton')}
      className={`space-y-2 ${className}`}
    >
      {Array.from({ length: rowCount }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-surface px-4 py-3 flex items-center justify-between gap-3"
        >
          {/* Left: date label */}
          <SkeletonRow height="h-4" widths={['w-20']} />
          {/* Right: calorie value */}
          <SkeletonRow height="h-4" widths={['w-14']} />
        </div>
      ))}
    </div>
  );
}
