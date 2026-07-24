"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleDot,
  FileText,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";

import { createStoryTaskOnBoard, deleteTask, toggleStoryTaskOnBoard } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { SpaceField, useSpace } from "@/components/space-context";
import { SubmitButton } from "@/components/submit-button";
import { TagBadge } from "@/components/tag-badge";
import { TagPicker } from "@/components/tag-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRIORITY_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useTaskDefaults } from "@/hooks/use-task-defaults";

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
    dueDate: Date | null;
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
  const router = useRouter();
  const { basePath } = useSpace();
  const { defaultPriority, defaultTagId } = useTaskDefaults();
  const [tasksOpen, setTasksOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const totalTasks = task.storyTasks.length;
  const doneTasks = task.storyTasks.filter((child) => child.isDone).length;
  const allDone = totalTasks > 0 && doneTasks === totalTasks;

  // Keep the card's drag/click wrapper from reacting to interactions inside the
  // expandable checklist (expanding, toggling a checkbox).
  const stopCardEvents = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <>
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-5">{task.title}</h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {projectId ? (
            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                aria-label="Edit task"
                onPointerDown={stopCardEvents}
                onClick={(event) => {
                  stopCardEvents(event);
                  router.push(`${basePath}/projects/${projectId}?task=${task.id}&edit=1`);
                }}
                className="flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Delete task"
                onPointerDown={stopCardEvents}
                onClick={(event) => {
                  stopCardEvents(event);
                  setConfirmOpen(true);
                }}
                className="flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ) : null}
          <Badge className={cn("shrink-0 border-0", priorityClasses[task.priority])}>
            {task.priority.toLowerCase()}
          </Badge>
        </div>
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
                    <ActionForm
                      action={toggleStoryTaskOnBoard}
                      successMessage={storyTask.isDone ? "Task marked as not done" : "Task marked as done"}
                      errorMessage="Couldn't update task. Please try again."
                      onClick={stopCardEvents}
                      onPointerDown={stopCardEvents}
                      className="contents"
                    >
                      <SpaceField />
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
                    </ActionForm>
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
                      "min-w-0 flex-1 truncate text-xs",
                      storyTask.isDone && "text-muted-foreground line-through",
                    )}
                  >
                    {storyTask.title}
                  </span>
                  {storyTask.dueDate || storyTask.tag ? (
                    <span className="ml-auto flex shrink-0 items-center gap-1.5">
                      {storyTask.dueDate ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <CalendarDays className="size-3" />
                          {format(storyTask.dueDate, "MMM d")}
                        </span>
                      ) : null}
                      {storyTask.tag ? (
                        <TagBadge tag={storyTask.tag} withIcon={false} className="text-[10px]" />
                      ) : null}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {projectId ? (
              adding ? (
                <ActionForm
                  action={createStoryTaskOnBoard}
                  successMessage="Task added"
                  errorMessage="Couldn't add task. Please try again."
                  onSuccess={() => titleInputRef.current?.focus()}
                  onClick={stopCardEvents}
                  onPointerDown={stopCardEvents}
                  className="mt-2 space-y-2 rounded-md border border-border/60 bg-muted/30 p-2"
                >
                  <SpaceField />
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="taskId" value={task.id} />
                  <div className="flex items-center gap-2">
                    <Input
                      ref={titleInputRef}
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
                    <Select
                      name="priority"
                      defaultValue={defaultPriority}
                      items={PRIORITY_OPTIONS.map((option) => ({
                        label: option.label,
                        value: option.value,
                      }))}
                    >
                      <SelectTrigger
                        size="sm"
                        aria-label="New task priority"
                        className="h-8 w-auto text-xs"
                      >
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DatePicker
                    id={`board-story-due-date-${task.id}`}
                    name="dueDate"
                    className="h-8 text-xs"
                  />
                  <TagPicker
                    idPrefix={`board-story-tag-${task.id}`}
                    defaultTag={task.tag}
                    defaultTagId={defaultTagId}
                  />
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
                </ActionForm>
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
    {projectId ? (
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          onClick={stopCardEvents}
          onPointerDown={stopCardEvents}
          className="sm:max-w-sm"
        >
          <DialogHeader>
            <DialogTitle>Delete task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete “{task.title}”? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <ActionForm action={deleteTask} errorMessage="Couldn't delete task. Please try again.">
              <SpaceField />
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="taskId" value={task.id} />
              <SubmitButton variant="destructive" pendingLabel="Deleting...">
                Delete task
              </SubmitButton>
            </ActionForm>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    ) : null}
    </>
  );
}
