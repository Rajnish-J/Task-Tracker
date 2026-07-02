import { Skeleton } from "@/components/ui/skeleton";

// Placeholder for a Kanban / section board while its cards load or a filter is
// being applied. Mirrors the real board layout: a horizontal row of columns,
// each holding a few card-shaped skeletons.
export function BoardSkeleton({
  columns = 4,
  cardsPerColumn = 3,
}: {
  columns?: number;
  cardsPerColumn?: number;
}) {
  return (
    <div className="grid min-h-full grid-flow-col gap-4 p-4 auto-cols-[minmax(16rem,1fr)] md:auto-cols-[minmax(20rem,1fr)] md:p-6">
      {Array.from({ length: columns }).map((_, columnIndex) => (
        <section
          key={columnIndex}
          className="flex h-full min-h-[calc(100vh-13rem)] flex-col rounded-lg border border-border/60 bg-card/80 p-3 shadow-sm backdrop-blur"
        >
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-5 w-7 rounded-md" />
          </div>
          <div className="flex flex-1 flex-col gap-3">
            {Array.from({ length: cardsPerColumn }).map((_, cardIndex) => (
              <CardSkeleton key={cardIndex} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-background/90 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-16 rounded-md" />
        <Skeleton className="h-6 w-20 rounded-md" />
      </div>
    </div>
  );
}
