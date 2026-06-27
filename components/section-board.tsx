"use client";

import { useRouter } from "next/navigation";

import { TaskCardContent } from "@/components/task-card-content";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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

  return (
    <ScrollArea className="h-full">
      <div className="grid min-h-full grid-flow-col gap-4 p-4 md:auto-cols-[22rem] md:p-6">
        {lanes.map((lane) => (
          <section
            key={lane.key}
            className="flex h-full min-h-[calc(100vh-13rem)] w-[20rem] flex-col rounded-lg border border-border/60 bg-card/80 p-3 shadow-sm backdrop-blur md:w-auto"
          >
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2">
                <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", lane.color)}>
                  {lane.label}
                </span>
              </div>
              <Badge variant="outline">{lane.tasks.length}</Badge>
            </div>

            <div className="flex flex-1 flex-col gap-3">
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
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
