import { Skeleton } from '@/components/ui/Skeleton';

/** Layout-matched placeholder for the Today screen. */
export function TodaySkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="rounded-card bg-card p-5 flex flex-col items-center">
        <Skeleton className="w-40 h-40 rounded-full" />
        <Skeleton className="mt-4 h-8 w-48 rounded-full" />
        <div className="mt-5 w-full grid grid-cols-3 gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
      <div className="rounded-card bg-card p-4">
        <Skeleton className="h-4 w-24 mb-3" />
        <div className="flex justify-between">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="w-8 h-14" />
          ))}
        </div>
      </div>
      <div className="rounded-card bg-card p-4 space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
