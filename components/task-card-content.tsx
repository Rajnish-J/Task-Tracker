"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleDot,
  FileText,
  ListChecks,
  Plus,
  Users,
} from "lucide-react";

import { createStoryTaskOnBoard, toggleStoryTaskOnBoard } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { TagBadge } from "@/components/tag-badge";
import { TagPicker } from "@/components/tag-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { PRIORITY_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const selectClassName =
  "h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type Tag = { id: string; name: string; color: string };

export type TaskCardData = {
  id: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  notes: string | null;
  priority: Priority;
  dueDate: Date | null;
  tag?: Tag | null;
  storyTasks: {
    id: string;
    title: string;
    priority: Priority;
    isDone: boolean;
    tag?: Tag | null;
  }[];
};

export const priorityClasses: Record<Priority, string> = {
  LOW: "bg-slate-500/15 text-slate-700 dark:text-slate-200",
  MEDIUM: "bg-sky-500/15 text-sky-700 dark:text-sky-200",
  HIGH: "bg-amber-500/15 text-amber-700 dark:text-amber-200",
  URGENT: "bg-rose-500/15 text-rose-700 dark:text-rose-200",
};

// Card body shared by the project Kanban board and the aggregated section board.
// When `projectId` is provided the checklist is interactive (toggle / add);
// otherwise it renders read-only. `projectName` shows a source-project badge on
// aggregated boards.
export function TaskCardContent({
  task,
  projectId,
  projectName,
}: {
  task: TaskCardData;
  projectId?: string;
  projectName?: string;
}) {
  const [tasksOpen, setTasksOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const totalTasks = task.storyTasks.length;
  const doneTasks = task.storyTasks.filter((child) => child.isDone).length;
  const allDone = totalTasks > 0 && doneTasks === totalTasks;

  // Keep the card's drag/click wrapper from reacting to interactions inside the
  // expandable checklist (expanding, toggling a checkbox).
  const stopCardEvents = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-5">{task.title}</h3>
        <Badge className={cn("shrink-0 border-0", priorityClasses[task.priority])}>
          {task.priority.toLowerCase()}
        </Badge>
      </div>
      {projectName || task.tag ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {projectName ? <Badge variant="secondary">{projectName}</Badge> : null}
          {task.tag ? <TagBadge tag={task.tag} /> : null}
        </div>
      ) : null}
      {projectId || totalTasks > 0 ? (
        <Collapsible open={tasksOpen} onOpenChange={setTasksOpen} className="space-y-1.5">
          <CollapsibleTrigger
            onClick={stopCardEvents}
            onPointerDown={stopCardEvents}
            className="flex w-full items-center justify-between gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none"
          >
            <span className="inline-flex items-center gap-1.5">
              <ChevronDown
                className={cn("size-3.5 transition-transform", tasksOpen && "rotate-180")}
              />
              <ListChecks className="size-3.5" />
              Tasks
            </span>
            <span className={cn(allDone && "text-emerald-600 dark:text-emerald-400")}>
              {doneTasks}/{totalTasks}
            </span>
          </CollapsibleTrigger>
          {totalTasks > 0 ? (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  allDone ? "bg-emerald-500" : "bg-primary",
                )}
                style={{ width: `${(doneTasks / totalTasks) * 100}%` }}
              />
            </div>
          ) : null}
          <CollapsibleContent>
            <ul className="space-y-1.5 pt-1">
              {task.storyTasks.map((storyTask) => (
                <li key={storyTask.id} className="flex items-center gap-2">
                  {projectId ? (
                    <form
                      action={toggleStoryTaskOnBoard}
                      onClick={stopCardEvents}
                      onPointerDown={stopCardEvents}
                      className="contents"
                    >
                      <input type="hidden" name="projectId" value={projectId} />
                      <input type="hidden" name="taskId" value={task.id} />
                      <input type="hidden" name="storyTaskId" value={storyTask.id} />
                      <input type="hidden" name="isDone" value={storyTask.isDone ? "false" : "true"} />
                      <button
                        type="submit"
                        aria-label={storyTask.isDone ? "Mark task as not done" : "Mark task as done"}
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                          storyTask.isDone
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-input hover:border-primary",
                        )}
                      >
                        {storyTask.isDone ? <Check className="size-3" /> : null}
                      </button>
                    </form>
                  ) : (
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border",
                        storyTask.isDone
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-input",
                      )}
                    >
                      {storyTask.isDone ? <Check className="size-3" /> : null}
                    </span>
                  )}
                  <span
                    className={cn(
                      "line-clamp-1 text-xs",
                      storyTask.isDone && "text-muted-foreground line-through",
                    )}
                  >
                    {storyTask.title}
                  </span>
                  {storyTask.tag ? (
                    <TagBadge tag={storyTask.tag} withIcon={false} className="ml-auto text-[10px]" />
                  ) : null}
                </li>
              ))}
            </ul>
            {projectId ? (
              adding ? (
                <form
                  action={createStoryTaskOnBoard}
                  onClick={stopCardEvents}
                  onPointerDown={stopCardEvents}
                  className="mt-2 space-y-2 rounded-md border border-border/60 bg-muted/30 p-2"
                >
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="taskId" value={task.id} />
                  <div className="flex items-center gap-2">
                    <Input
                      name="title"
                      required
                      maxLength={120}
                      placeholder="New task title"
                      aria-label="New task title"
                      className="h-8 flex-1 text-xs"
                      autoFocus
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === "Escape") setAdding(false);
                      }}
                    />
                    <select
                      name="priority"
                      defaultValue="MEDIUM"
                      aria-label="New task priority"
                      className={selectClassName}
                    >
                      {PRIORITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <TagPicker idPrefix={`board-story-tag-${task.id}`} />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setAdding(false)}
                    >
                      Cancel
                    </Button>
                    <SubmitButton
                      size="sm"
                      className="h-7 px-2 text-xs"
                      pendingLabel="Adding..."
                    >
                      Add task
                    </SubmitButton>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={(event) => {
                    stopCardEvents(event);
                    setAdding(true);
                  }}
                  onPointerDown={stopCardEvents}
                  className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border/60 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Plus className="size-3.5" />
                  Add task
                </button>
              )
            ) : null}
          </CollapsibleContent>
        </Collapsible>
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
