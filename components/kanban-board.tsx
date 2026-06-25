"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarDays, CircleDot, FileText, ListChecks, Users } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { moveTask } from "@/app/actions";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type Task = {
  id: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  notes: string | null;
  priority: Priority;
  dueDate: Date | null;
  storyTasks: { id: string; isDone: boolean }[];
};

type Column = {
  id: string;
  name: string;
  color: string | null;
  tasks: Task[];
};

type KanbanBoardProps = {
  project: {
    id: string;
    columns: Column[];
  };
};

const priorityClasses: Record<Priority, string> = {
  LOW: "bg-slate-500/15 text-slate-700 dark:text-slate-200",
  MEDIUM: "bg-sky-500/15 text-sky-700 dark:text-sky-200",
  HIGH: "bg-amber-500/15 text-amber-700 dark:text-amber-200",
  URGENT: "bg-rose-500/15 text-rose-700 dark:text-rose-200",
};

export function KanbanBoard({ project }: KanbanBoardProps) {
  const router = useRouter();
  const [board, setBoard] = React.useState<Column[]>(project.columns);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  // Keep a ref of the live board so drag handlers can read the latest state
  // synchronously when computing the persisted position.
  const boardRef = React.useRef(board);
  boardRef.current = board;

  // Re-sync with server data whenever the board's shape/order changes (e.g.
  // after a revalidate from creating, editing, or moving a task).
  const signature = React.useMemo(
    () =>
      project.columns
        .map((column) => `${column.id}:${column.tasks.map((task) => task.id).join(",")}`)
        .join("|"),
    [project.columns],
  );
  const lastSignature = React.useRef(signature);
  React.useEffect(() => {
    if (lastSignature.current !== signature) {
      setBoard(project.columns);
      lastSignature.current = signature;
    }
  }, [signature, project.columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const findColumnId = React.useCallback((id: string) => {
    const current = boardRef.current;
    if (current.some((column) => column.id === id)) {
      return id;
    }
    return current.find((column) => column.tasks.some((task) => task.id === id))?.id;
  }, []);

  const activeTask = React.useMemo(
    () =>
      activeId
        ? board.flatMap((column) => column.tasks).find((task) => task.id === activeId) ?? null
        : null,
    [activeId, board],
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const fromColumnId = findColumnId(activeId);
    const toColumnId = findColumnId(overId);

    if (!fromColumnId || !toColumnId || fromColumnId === toColumnId) {
      return;
    }

    setBoard((prev) => {
      const fromColumn = prev.find((column) => column.id === fromColumnId);
      const toColumn = prev.find((column) => column.id === toColumnId);
      if (!fromColumn || !toColumn) return prev;

      const movedTask = fromColumn.tasks.find((task) => task.id === activeId);
      if (!movedTask) return prev;

      const overIndex = toColumn.tasks.findIndex((task) => task.id === overId);
      const insertAt = overIndex >= 0 ? overIndex : toColumn.tasks.length;

      return prev.map((column) => {
        if (column.id === fromColumnId) {
          return { ...column, tasks: column.tasks.filter((task) => task.id !== activeId) };
        }
        if (column.id === toColumnId) {
          const next = [...column.tasks];
          next.splice(insertAt, 0, movedTask);
          return { ...column, tasks: next };
        }
        return column;
      });
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const movedId = String(active.id);
    const overId = String(over.id);
    const columnId = findColumnId(movedId);
    if (!columnId) return;

    // Same-column reorder: arrayMove within the column.
    let nextBoard = boardRef.current;
    const overColumnId = findColumnId(overId);
    if (overColumnId === columnId && movedId !== overId) {
      nextBoard = boardRef.current.map((column) => {
        if (column.id !== columnId) return column;
        const oldIndex = column.tasks.findIndex((task) => task.id === movedId);
        const newIndex = column.tasks.findIndex((task) => task.id === overId);
        if (oldIndex < 0 || newIndex < 0) return column;
        return { ...column, tasks: arrayMove(column.tasks, oldIndex, newIndex) };
      });
      setBoard(nextBoard);
    }

    const targetColumn = nextBoard.find((column) => column.id === columnId);
    const toIndex = targetColumn?.tasks.findIndex((task) => task.id === movedId) ?? 0;

    void moveTask({
      projectId: project.id,
      taskId: movedId,
      toColumnId: columnId,
      toIndex: Math.max(0, toIndex),
    }).then(() => router.refresh());
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <ScrollArea className="h-full">
        <div className="grid min-h-full grid-flow-col gap-4 p-4 md:auto-cols-[22rem] md:p-6">
          {board.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              projectId={project.id}
              columnOptions={board.map((c) => ({ id: c.id, name: c.name }))}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

type BoardColumnProps = {
  column: Column;
  projectId: string;
  columnOptions: { id: string; name: string }[];
};

function BoardColumn({ column, projectId, columnOptions }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section className="flex h-full min-h-[calc(100vh-13rem)] w-[20rem] flex-col rounded-lg border border-border/60 bg-card/80 p-3 shadow-sm backdrop-blur md:w-auto">
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

      <SortableContext items={column.tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "flex flex-1 flex-col gap-3 rounded-md transition-colors",
            isOver && "bg-primary/5 ring-1 ring-primary/20",
          )}
        >
          {column.tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} projectId={projectId} />
          ))}
        </div>
      </SortableContext>

      <div className="mt-3">
        <CreateTaskDialog
          projectId={projectId}
          columnId={column.id}
          columns={columnOptions}
          trigger={
            <Button variant="outline" className="w-full justify-center gap-2">
              Add New Task
            </Button>
          }
        />
      </div>
    </section>
  );
}

type SortableTaskCardProps = {
  task: Task;
  projectId: string;
};

function SortableTaskCard({ task, projectId }: SortableTaskCardProps) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/projects/${projectId}?task=${task.id}`)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(`/projects/${projectId}?task=${task.id}`);
        }
      }}
      className="cursor-grab touch-none rounded-lg border border-border/60 bg-background/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
    >
      <TaskCardContent task={task} />
    </div>
  );
}

function TaskCard({ task, dragging }: { task: Task; dragging?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-background p-4 shadow-md",
        dragging && "rotate-2 cursor-grabbing",
      )}
    >
      <TaskCardContent task={task} />
    </div>
  );
}

function TaskCardContent({ task }: { task: Task }) {
  const totalTasks = task.storyTasks.length;
  const doneTasks = task.storyTasks.filter((child) => child.isDone).length;
  const allDone = totalTasks > 0 && doneTasks === totalTasks;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-5">{task.title}</h3>
        <Badge className={cn("shrink-0 border-0", priorityClasses[task.priority])}>
          {task.priority.toLowerCase()}
        </Badge>
      </div>
      {totalTasks > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ListChecks className="size-3.5" />
              Tasks
            </span>
            <span className={cn(allDone && "text-emerald-600 dark:text-emerald-400")}>
              {doneTasks}/{totalTasks}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                allDone ? "bg-emerald-500" : "bg-primary",
              )}
              style={{ width: `${(doneTasks / totalTasks) * 100}%` }}
            />
          </div>
        </div>
      ) : null}
      {task.shortDescription ? (
        <p className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 px-2 py-1 text-xs font-medium text-foreground/80">
          <Users className="size-3.5 shrink-0" />
          <span className="line-clamp-1">{task.shortDescription}</span>
        </p>
      ) : null}
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
  );
}
