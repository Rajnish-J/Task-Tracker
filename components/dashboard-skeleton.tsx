import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Placeholder for the dashboard while its data loads — including the brief
// re-render when the tag filter changes (the page is force-dynamic, so the
// route's loading.tsx fallback shows during that navigation). Matches the KPI
// grid + three-chart layout.
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 10 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="size-4 rounded-sm" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-40" />
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <Skeleton className="aspect-square max-h-[260px] w-[260px] rounded-full" />
              <div className="flex flex-wrap justify-center gap-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
