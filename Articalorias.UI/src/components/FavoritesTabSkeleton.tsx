import { useTranslation } from 'react-i18next';
import SkeletonRow from './SkeletonRow';

interface FavoritesTabSkeletonProps {
  /** Number of skeleton favorite rows to render. @default 5 */
  rowCount?: number;
  /** Additional Tailwind classes applied to the outer wrapper. */
  className?: string;
}

export default function FavoritesTabSkeleton({
  rowCount = 5,
  className = '',
}: FavoritesTabSkeletonProps) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t('common.loading')}
      className={`space-y-3 ${className}`}
    >
      {Array.from({ length: rowCount }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-surface p-3 flex items-center gap-3"
        >
          {/* Left: name + detail lines */}
          <div className="flex-1 space-y-2 min-w-0">
            <SkeletonRow height="h-4" widths={['w-2/3']} />
            <SkeletonRow height="h-3" widths={['w-1/3']} />
          </div>
          {/* Right: quick-add button placeholder */}
          <SkeletonRow height="h-8" widths={['w-8']} className="shrink-0" />
        </div>
      ))}
    </div>
  );
}
