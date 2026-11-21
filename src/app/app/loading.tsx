import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
