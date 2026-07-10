"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
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
import { useSpace } from "@/components/space-context";
import { TaskCardContent, type TaskCardData } from "@/components/task-card-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Task = TaskCardData;

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

export function KanbanBoard({ project }: KanbanBoardProps) {
  const router = useRouter();
  const { teamId } = useSpace();
  const [board, setBoard] = React.useState<Column[]>(project.columns);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  // Keep a ref of the live board so drag handlers can read the latest state
  // synchronously when computing the persisted position.
  const boardRef = React.useRef(board);
  React.useEffect(() => {
    boardRef.current = board;
  }, [board]);

  // Re-sync with server data whenever the board's shape/order changes (e.g.
  // after a revalidate from creating, editing, or moving a task) — including the
  // per-card checklist, so ticking or adding a sub-task on the board re-renders.
  const signature = React.useMemo(
    () =>
      project.columns
        .map(
          (column) =>
            `${column.id}:${column.tasks
              .map(
                (task) =>
                  `${task.id}[${task.storyTasks
                    .map((story) => `${story.id}:${story.isDone ? 1 : 0}`)
                    .join(",")}]`,
              )
              .join(",")}`,
        )
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const movedId = String(active.id);
    const overId = String(over.id);

    // The board is not mutated during the drag, so compute the whole move here.
    const fromColumnId = findColumnId(movedId);
    const toColumnId = findColumnId(overId);
    if (!fromColumnId || !toColumnId) return;

    const current = boardRef.current;
    const fromColumn = current.find((column) => column.id === fromColumnId);
    const toColumn = current.find((column) => column.id === toColumnId);
    if (!fromColumn || !toColumn) return;

    const movedTask = fromColumn.tasks.find((task) => task.id === movedId);
    if (!movedTask) return;

    let nextBoard: Column[];
    let toIndex: number;

    if (fromColumnId === toColumnId) {
      // Same-column reorder. When dropped on empty space (overId is the column
      // id, not a task) move the card to the end.
      const oldIndex = fromColumn.tasks.findIndex((task) => task.id === movedId);
      const overIndex = fromColumn.tasks.findIndex((task) => task.id === overId);
      const newIndex = overIndex >= 0 ? overIndex : fromColumn.tasks.length - 1;
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      nextBoard = current.map((column) =>
        column.id === fromColumnId
          ? { ...column, tasks: arrayMove(column.tasks, oldIndex, newIndex) }
          : column,
      );
      toIndex = newIndex;
    } else {
      // Cross-column move: remove from the source, splice into the target at the
      // hovered card's index (or append when dropped on the column itself).
      const overIndex = toColumn.tasks.findIndex((task) => task.id === overId);
      const insertAt = overIndex >= 0 ? overIndex : toColumn.tasks.length;
      nextBoard = current.map((column) => {
        if (column.id === fromColumnId) {
          return { ...column, tasks: column.tasks.filter((task) => task.id !== movedId) };
        }
        if (column.id === toColumnId) {
          const next = [...column.tasks];
          next.splice(insertAt, 0, movedTask);
          return { ...column, tasks: next };
        }
        return column;
      });
      toIndex = insertAt;
    }

    setBoard(nextBoard);

    void moveTask(
      {
        projectId: project.id,
        taskId: movedId,
        toColumnId,
        toIndex: Math.max(0, toIndex),
      },
      teamId ?? undefined,
    ).then(() => router.refresh());
  }

  return (
    <div className="flex h-full flex-col">
      <DndContext
        id="kanban-board"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <ScrollArea className="h-full flex-1">
          <div className="grid min-h-full grid-flow-col gap-4 p-4 auto-cols-[minmax(16rem,1fr)] md:auto-cols-[minmax(20rem,1fr)] md:p-6">
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
    </div>
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
    <section className="flex h-[calc(100vh-13rem)] flex-col rounded-lg border border-border/60 bg-card/80 p-3 shadow-sm backdrop-blur">
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
            "thin-scrollbar flex flex-1 flex-col gap-3 min-h-0 overflow-y-auto rounded-md transition-colors",
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
  const { basePath } = useSpace();
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
      // A stationary click opens the task detail; the PointerSensor's 5px
      // activation distance means a drag never fires this. Inner controls
      // stopPropagation, so they keep their own behavior.
      onClick={() => router.push(`${basePath}/projects/${projectId}?task=${task.id}`)}
      className="group cursor-grab touch-none rounded-lg border border-border/60 bg-background/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
    >
      <TaskCardContent task={task} projectId={projectId} />
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
