import { Skeleton } from '@/components/ui/Skeleton';

/** Layout-matched placeholder for the Progress screen. */
export function ProgressSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="rounded-card bg-card p-4">
        <Skeleton className="h-4 w-24 mb-3" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
        <Skeleton className="mt-3 h-4 w-2/3" />
      </div>
      <div className="rounded-card bg-card p-4">
        <Skeleton className="h-4 w-32 mb-3" />
        <Skeleton className="h-[190px] w-full" />
      </div>
      <div className="rounded-card bg-card p-4 space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
