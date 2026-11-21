import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4", className)} aria-hidden />;
}

export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <Skeleton className="h-7 w-56" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
      </div>
      <div className="space-y-2 rounded-lg border border-border bg-surface p-4">
        {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-12" />)}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
