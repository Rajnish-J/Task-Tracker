"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { BoardSkeleton } from "@/components/board-skeleton";
import { BoardTagFilter } from "@/components/board-tag-filter";
import { TaskCardContent } from "@/components/task-card-content";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { collectBoardTags, taskMatchesTag } from "@/lib/board-filter";
import { cn } from "@/lib/utils";
import type { SectionBoardLane } from "@/lib/data";

type SectionBoardProps = {
  sectionId: string;
  lanes: SectionBoardLane[];
};

// Read-only aggregated board. Lanes are normalized status keys (cards come from
// many projects with their own columns), so cards open the details sheet but are
// not draggable. Each card shows its source project as a badge.
export function SectionBoard({ sectionId, lanes }: SectionBoardProps) {
  const router = useRouter();
  const [selectedTagId, setSelectedTagId] = React.useState("");
  // Brief skeleton flash while the filter re-applies, for a clear "loading" beat.
  const [isFiltering, setIsFiltering] = React.useState(false);
  const filterTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (filterTimeout.current) clearTimeout(filterTimeout.current);
    },
    [],
  );

  function handleTagChange(tagId: string) {
    setSelectedTagId(tagId);
    setIsFiltering(true);
    if (filterTimeout.current) clearTimeout(filterTimeout.current);
    filterTimeout.current = setTimeout(() => setIsFiltering(false), 300);
  }

  const availableTags = React.useMemo(
    () => collectBoardTags(lanes.flatMap((lane) => lane.tasks)),
    [lanes],
  );

  const visibleLanes = React.useMemo(() => {
    if (!selectedTagId) return lanes;
    return lanes.map((lane) => ({
      ...lane,
      tasks: lane.tasks.filter((task) => taskMatchesTag(task, selectedTagId)),
    }));
  }, [lanes, selectedTagId]);

  return (
    <div className="flex h-full flex-col">
      {availableTags.length > 0 ? (
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2 md:px-6">
          <BoardTagFilter tags={availableTags} value={selectedTagId} onChange={handleTagChange} />
        </div>
      ) : null}

      <ScrollArea className="h-full flex-1">
        {isFiltering ? (
          <BoardSkeleton columns={visibleLanes.length || 3} />
        ) : (
          <div className="grid min-h-full grid-flow-col gap-4 p-4 auto-cols-[minmax(16rem,1fr)] md:auto-cols-[minmax(20rem,1fr)] md:p-6">
            {visibleLanes.map((lane) => (
              <section
                key={lane.key}
                className="flex h-[calc(100vh-13rem)] flex-col rounded-lg border border-border/60 bg-card/80 p-3 shadow-sm backdrop-blur"
              >
                <div className="mb-3 flex items-center justify-between gap-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", lane.color)}>
                      {lane.label}
                    </span>
                  </div>
                  <Badge variant="outline">{lane.tasks.length}</Badge>
                </div>

                <div className="thin-scrollbar flex flex-1 flex-col gap-3 min-h-0 overflow-y-auto">
                  {lane.tasks.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border/60 px-3 py-6 text-center text-xs text-muted-foreground">
                      No cards
                    </p>
                  ) : null}
                  {lane.tasks.map((task) => (
                    <div
                      key={task.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/sections/${sectionId}?task=${task.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(`/sections/${sectionId}?task=${task.id}`);
                        }
                      }}
                      className="cursor-pointer rounded-lg border border-border/60 bg-background/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <TaskCardContent task={task} projectName={task.projectName} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
