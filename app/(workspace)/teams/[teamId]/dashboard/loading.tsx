import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { HeaderBreadcrumb } from "@/components/header-slots";
import { Skeleton } from "@/components/ui/skeleton";

// Shown while the dashboard loads — and, because the page is force-dynamic,
// during the brief re-render when the tag filter changes the `?tag=` param.
export default function DashboardLoading() {
  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto">
      <HeaderBreadcrumb>
        <Skeleton className="h-4 w-32" />
      </HeaderBreadcrumb>
      <header className="border-b border-border/60 bg-background/80 px-4 py-4 backdrop-blur md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <Skeleton className="h-9 w-56" />
        </div>
      </header>

      <DashboardSkeleton />
    </div>
  );
}
