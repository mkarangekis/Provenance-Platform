import { Skeleton } from "@/components/ui/skeleton";

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton key={idx} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-2xl" />
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full rounded-lg" />
      {Array.from({ length: rows }).map((_, idx) => (
        <Skeleton key={idx} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, idx) => (
        <Skeleton key={idx} className="h-40 rounded-2xl" />
      ))}
    </div>
  );
}
