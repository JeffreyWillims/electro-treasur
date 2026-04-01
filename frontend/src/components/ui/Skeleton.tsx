/**
 * Skeleton Loader — animate-pulse placeholder for async data.
 * Used while O(N) aggregation or arq worker is processing.
 */
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] animate-shimmer',
        className,
      )}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-surface-border bg-white p-6 shadow-card space-y-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div className="rounded-2xl border border-surface-border bg-white p-6 shadow-card space-y-3">
      <Skeleton className="h-5 w-1/4 mb-4" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-4 w-1/5" />
          <Skeleton className="h-4 w-1/6" />
          <Skeleton className="h-4 w-1/6" />
          <Skeleton className="h-4 w-1/6" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}
