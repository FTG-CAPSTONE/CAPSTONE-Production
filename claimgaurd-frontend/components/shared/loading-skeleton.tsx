import { Skeleton } from "@/components/ui/skeleton";

// Deterministic width sequence — avoids server/client hydration mismatch
// that occurs when Math.random() produces different values on each render.
const WIDTHS = [68, 82, 73, 91, 65, 78, 62, 87, 74, 96, 61, 83, 76, 90, 70];
function getWidth(i: number) {
  return `${WIDTHS[i % WIDTHS.length]}%`;
}

export function StatRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-32" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Header row */}
      <div
        className="border-b border-border bg-muted/40 px-4 py-3 grid gap-4"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="border-b border-border last:border-0 px-4 py-3 grid gap-4"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton
              key={j}
              className="h-4"
              style={{ width: getWidth(i * cols + j) }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-4" style={{ width: getWidth(i + 5) }} />
      ))}
    </div>
  );
}
