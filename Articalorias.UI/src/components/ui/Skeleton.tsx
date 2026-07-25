import { cn } from '@/utils/cn';

interface SkeletonProps {
  className?: string;
}

/** Shimmering placeholder block. Compose into layout-matched skeletons. */
export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('skeleton', className)} aria-hidden="true" />;
}

/** A generic card-shaped skeleton row group */
export function SkeletonCard({ rows = 2, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('rounded-card bg-card p-4 space-y-3', className)} aria-busy="true">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
