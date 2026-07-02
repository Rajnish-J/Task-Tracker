"use client";

import * as React from "react";
import { format } from "date-fns";
import { Check, ListChecks, Pencil, Plus, Trash2, X } from "lucide-react";

import { createStoryTask, deleteStoryTask, toggleStoryTask, updateStoryTask } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { TagBadge } from "@/components/tag-badge";
import { TagPicker } from "@/components/tag-picker";
import { PRIORITY_OPTIONS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type Tag = { id: string; name: string; color: string };

type StoryTask = {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  dueDate: Date | null;
  isDone: boolean;
  tag?: Tag | null;
};

type StoryTasksPanelProps = {
  projectId: string;
  storyId: string;
  storyTasks: StoryTask[];
};

const priorityClasses: Record<Priority, string> = {
  LOW: "bg-slate-500/15 text-slate-700 dark:text-slate-200",
  MEDIUM: "bg-sky-500/15 text-sky-700 dark:text-sky-200",
  HIGH: "bg-amber-500/15 text-amber-700 dark:text-amber-200",
  URGENT: "bg-rose-500/15 text-rose-700 dark:text-rose-200",
};

export function StoryTasksPanel({ projectId, storyId, storyTasks }: StoryTasksPanelProps) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);

  const total = storyTasks.length;
  const done = storyTasks.filter((task) => task.isDone).length;
  const allDone = total > 0 && done === total;

  return (
    <section className="space-y-3 border-t border-border/60 pt-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="inline-flex items-center gap-2 text-sm font-medium">
            <ListChecks className="size-4" />
            Tasks
          </h3>
          <span
            className={cn(
              "text-xs font-medium text-muted-foreground",
              allDone && "text-emerald-600 dark:text-emerald-400",
            )}
          >
            {total === 0 ? "No tasks yet" : `${done} of ${total} done`}
          </span>
        </div>
        {total > 0 ? (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", allDone ? "bg-emerald-500" : "bg-primary")}
              style={{ width: `${(done / total) * 100}%` }}
            />
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          This story completes — and moves to Done — only when every task is checked off.
        </p>
      </div>

      <ul className="space-y-2">
        {storyTasks.map((task) =>
          editingId === task.id ? (
            <li key={task.id} className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <StoryTaskEditForm
                projectId={projectId}
                storyId={storyId}
                task={task}
                onDone={() => setEditingId(null)}
              />
            </li>
          ) : (
            <li
              key={task.id}
              className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/60 p-3"
            >
              <form action={toggleStoryTask} className="pt-0.5">
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="taskId" value={storyId} />
                <input type="hidden" name="storyTaskId" value={task.id} />
                <input type="hidden" name="isDone" value={task.isDone ? "false" : "true"} />
                <button
                  type="submit"
                  aria-label={task.isDone ? "Mark task as not done" : "Mark task as done"}
                  className={cn(
                    "flex size-5 items-center justify-center rounded border transition-colors",
                    task.isDone
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-input hover:border-primary",
                  )}
                >
                  {task.isDone ? <Check className="size-3.5" /> : null}
                </button>
              </form>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      task.isDone && "text-muted-foreground line-through",
                    )}
                  >
                    {task.title}
                  </span>
                  <Badge className={cn("shrink-0 border-0 text-[10px]", priorityClasses[task.priority])}>
                    {task.priority.toLowerCase()}
                  </Badge>
                </div>
                {task.description ? (
                  <p className="text-xs text-muted-foreground">{task.description}</p>
                ) : null}
                {task.dueDate ? (
                  <p className="text-xs text-muted-foreground">Due {format(task.dueDate, "MMM d, yyyy")}</p>
                ) : null}
                {task.tag ? <TagBadge tag={task.tag} className="text-[10px]" /> : null}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label="Edit task"
                  onClick={() => setEditingId(task.id)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <form action={deleteStoryTask}>
                  <input type="hidden" name="projectId" value={projectId} />
                  <input type="hidden" name="taskId" value={storyId} />
                  <input type="hidden" name="storyTaskId" value={task.id} />
                  <SubmitButton
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive hover:text-destructive"
                    aria-label="Delete task"
                    pendingLabel=""
                  >
                    <Trash2 className="size-3.5" />
                  </SubmitButton>
                </form>
              </div>
            </li>
          ),
        )}
      </ul>

      {adding ? (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <StoryTaskCreateForm
            projectId={projectId}
            storyId={storyId}
            onDone={() => setAdding(false)}
          />
        </div>
      ) : (
        <Button type="button" variant="outline" className="w-full justify-center gap-2" onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          Add task
        </Button>
      )}
    </section>
  );
}

function StoryTaskCreateForm({
  projectId,
  storyId,
  onDone,
}: {
  projectId: string;
  storyId: string;
  onDone: () => void;
}) {
  return (
    <form action={createStoryTask} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="taskId" value={storyId} />
      <StoryTaskFields />
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <SubmitButton size="sm" pendingLabel="Adding...">
          Add task
        </SubmitButton>
      </div>
    </form>
  );
}

function StoryTaskEditForm({
  projectId,
  storyId,
  task,
  onDone,
}: {
  projectId: string;
  storyId: string;
  task: StoryTask;
  onDone: () => void;
}) {
  return (
    <form action={updateStoryTask} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="taskId" value={storyId} />
      <input type="hidden" name="storyTaskId" value={task.id} />
      <StoryTaskFields task={task} />
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          <X className="size-3.5" />
          Cancel
        </Button>
        <SubmitButton size="sm" variant="secondary" pendingLabel="Saving...">
          Save
        </SubmitButton>
      </div>
    </form>
  );
}

function StoryTaskFields({ task }: { task?: StoryTask }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <Input
          name="title"
          required
          maxLength={120}
          defaultValue={task?.title ?? ""}
          placeholder="Task title"
          aria-label="Task title"
        />
        <Select
          name="priority"
          defaultValue={task?.priority ?? "MEDIUM"}
          items={PRIORITY_OPTIONS.map((option) => ({
            label: option.label,
            value: option.value,
          }))}
        >
          <SelectTrigger aria-label="Task priority" className="w-full">
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
      <Textarea
        name="description"
        rows={2}
        maxLength={600}
        defaultValue={task?.description ?? ""}
        placeholder="Optional details"
        aria-label="Task description"
      />
      <Input
        name="dueDate"
        type="date"
        defaultValue={task?.dueDate ? format(task.dueDate, "yyyy-MM-dd") : ""}
        aria-label="Task due date"
      />
      <TagPicker defaultTag={task?.tag ?? null} idPrefix={`story-tag-${task?.id ?? "new"}`} />
    </>
  );
}
