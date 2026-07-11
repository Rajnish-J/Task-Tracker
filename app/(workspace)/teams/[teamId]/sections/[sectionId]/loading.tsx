import { BoardSkeleton } from "@/components/board-skeleton";
import { HeaderBreadcrumb } from "@/components/header-slots";
import { Skeleton } from "@/components/ui/skeleton";

export default function SectionLoading() {
  return (
    <div className="flex h-full flex-1 flex-col">
      <HeaderBreadcrumb>
        <Skeleton className="h-4 w-32" />
      </HeaderBreadcrumb>
      <header className="border-b border-border/60 bg-background/80 px-4 py-4 backdrop-blur md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-9 w-40" />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <BoardSkeleton columns={3} />
      </div>
    </div>
  );
}
