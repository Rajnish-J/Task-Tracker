import Link from "next/link";
import { format } from "date-fns";
import { CalendarDays, CircleDot, FileText } from "lucide-react";

import { CreateTaskDialog } from "@/components/create-task-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type KanbanBoardProps = {
  project: {
    id: string;
    columns: {
      id: string;
      name: string;
      color: string | null;
      tasks: {
        id: string;
        title: string;
        description: string | null;
        notes: string | null;
        priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
        dueDate: Date | null;
      }[];
    }[];
  };
};

const priorityClasses: Record<KanbanBoardProps["project"]["columns"][number]["tasks"][number]["priority"], string> = {
  LOW: "bg-slate-500/15 text-slate-700 dark:text-slate-200",
  MEDIUM: "bg-sky-500/15 text-sky-700 dark:text-sky-200",
  HIGH: "bg-amber-500/15 text-amber-700 dark:text-amber-200",
  URGENT: "bg-rose-500/15 text-rose-700 dark:text-rose-200",
};

export function KanbanBoard({ project }: KanbanBoardProps) {
  const columns = project.columns.map((column) => ({ id: column.id, name: column.name }));

  return (
    <ScrollArea className="h-full">
      <div className="grid min-h-full grid-flow-col gap-4 p-4 md:auto-cols-[22rem] md:p-6">
        {project.columns.map((column) => (
          <section
            key={column.id}
            className="flex h-full min-h-[calc(100vh-13rem)] w-[20rem] flex-col rounded-lg border border-border/60 bg-card/80 p-3 shadow-sm backdrop-blur md:w-auto"
          >
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", column.color?.split(" ")[0] ?? "bg-primary/20")} />
                  <h2 className="font-semibold">{column.name}</h2>
                </div>
                <p className="text-xs text-muted-foreground">{column.tasks.length} tasks</p>
              </div>
              <Badge variant="outline">{column.tasks.length}</Badge>
            </div>

            <div className="flex flex-1 flex-col gap-3">
              {column.tasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/projects/${project.id}?task=${task.id}`}
                  className="rounded-lg border border-border/60 bg-background/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-5">{task.title}</h3>
                      <Badge className={cn("shrink-0 border-0", priorityClasses[task.priority])}>
                        {task.priority.toLowerCase()}
                      </Badge>
                    </div>
                    {task.description ? (
                      <p className="line-clamp-3 text-sm text-muted-foreground">{task.description}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {task.dueDate ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                          <CalendarDays className="size-3.5" />
                          {format(task.dueDate, "MMM d")}
                        </span>
                      ) : null}
                      {task.notes ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                          <FileText className="size-3.5" />
                          Notes
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                        <CircleDot className="size-3.5" />
                        Open card
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-3">
              <CreateTaskDialog
                projectId={project.id}
                columnId={column.id}
                columns={columns}
                trigger={
                  <Button variant="outline" className="w-full justify-center gap-2">
                    Add New Task
                  </Button>
                }
              />
            </div>
          </section>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
