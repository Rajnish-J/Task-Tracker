"use client";

import * as React from "react";
import { format } from "date-fns";
import { Check, ListChecks, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

import { createStoryTask, deleteStoryTask, toggleStoryTask, updateStoryTasksBatch } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { SpaceField, useSpace } from "@/components/space-context";
import { SubmitButton } from "@/components/submit-button";
import { TagBadge } from "@/components/tag-badge";
import { TagPicker } from "@/components/tag-picker";
import { PRIORITY_OPTIONS } from "@/lib/constants";
import { runWithToast } from "@/lib/toast-action";
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
import { useTaskDefaults } from "@/hooks/use-task-defaults";

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
  const { teamId } = useSpace();
  const [editingIds, setEditingIds] = React.useState<Set<string>>(new Set());
  const [adding, setAdding] = React.useState(false);
  const [isSaving, startSaving] = React.useTransition();
  const formRefs = React.useRef(new Map<string, HTMLFormElement>());

  const total = storyTasks.length;
  const done = storyTasks.filter((task) => task.isDone).length;
  const allDone = total > 0 && done === total;

  function startEditing(taskId: string) {
    setEditingIds((prev) => new Set(prev).add(taskId));
  }

  function stopEditing(taskId: string) {
    formRefs.current.delete(taskId);
    setEditingIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  }

  function handleSaveAll() {
    const items: Record<string, string>[] = [];

    for (const taskId of editingIds) {
      const form = formRefs.current.get(taskId);
      if (!form) continue;
      if (!form.reportValidity()) return;

      const fields = new FormData(form);
      items.push({
        storyTaskId: taskId,
        title: fields.get("title") as string,
        description: (fields.get("description") as string) || "",
        priority: fields.get("priority") as string,
        dueDate: (fields.get("dueDate") as string) || "",
        tagId: (fields.get("tagId") as string) || "",
        tagName: (fields.get("tagName") as string) || "",
        tagColor: (fields.get("tagColor") as string) || "",
      });
    }

    if (items.length === 0) return;

    const payload = new FormData();
    if (teamId) payload.set("teamId", teamId);
    payload.set("projectId", projectId);
    payload.set("taskId", storyId);
    payload.set("items", JSON.stringify(items));

    // No success branch here on purpose: updateStoryTasksBatch redirects back
    // into this same task on success (mirrors ActionForm's convention below —
    // the navigation/remount is the signal, and it resets editingIds to empty).
    startSaving(() =>
      runWithToast(() => updateStoryTasksBatch(payload), {
        error: "Couldn't save changes. Please try again.",
      }),
    );
  }

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

      {editingIds.size > 0 ? (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/95 p-2 shadow-sm backdrop-blur">
          <span className="text-xs font-medium text-muted-foreground">
            {editingIds.size} task{editingIds.size === 1 ? "" : "s"} being edited
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isSaving}
              onClick={() => setEditingIds(new Set())}
            >
              Cancel all
            </Button>
            <Button type="button" size="sm" disabled={isSaving} onClick={handleSaveAll}>
              {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Save changes
            </Button>
          </div>
        </div>
      ) : null}

      <ul className="space-y-2">
        {storyTasks.map((task) =>
          editingIds.has(task.id) ? (
            <li key={task.id} className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <StoryTaskEditForm
                ref={(form) => {
                  if (form) formRefs.current.set(task.id, form);
                  else formRefs.current.delete(task.id);
                }}
                task={task}
                onCancel={() => stopEditing(task.id)}
              />
            </li>
          ) : (
            <li
              key={task.id}
              className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/60 p-3"
            >
              <ActionForm
                action={toggleStoryTask}
                errorMessage="Couldn't update task. Please try again."
                className="pt-0.5"
              >
                <SpaceField />
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
              </ActionForm>

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
                  onClick={() => startEditing(task.id)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <ActionForm action={deleteStoryTask} errorMessage="Couldn't delete task. Please try again.">
                  <SpaceField />
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
                </ActionForm>
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
  const { defaultPriority, defaultTagId } = useTaskDefaults();
  return (
    <ActionForm
      action={createStoryTask}
      errorMessage="Couldn't add task. Please try again."
      className="space-y-3"
    >
      <SpaceField />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="taskId" value={storyId} />
      <StoryTaskFields defaultPriority={defaultPriority} defaultTagId={defaultTagId} />
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <SubmitButton size="sm" pendingLabel="Adding...">
          Add task
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

// Holds one task's edit fields for the panel-wide "Save changes" batch — it
// never submits itself. Its form ref is read on demand by handleSaveAll, and
// the only way this task leaves edit mode on its own is the Cancel button.
const StoryTaskEditForm = React.forwardRef<
  HTMLFormElement,
  { task: StoryTask; onCancel: () => void }
>(function StoryTaskEditForm({ task, onCancel }, ref) {
  return (
    <form ref={ref} className="space-y-3" onSubmit={(event) => event.preventDefault()}>
      <StoryTaskFields task={task} />
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="size-3.5" />
          Cancel
        </Button>
      </div>
    </form>
  );
});

function StoryTaskFields({
  task,
  defaultPriority,
  defaultTagId,
}: {
  task?: StoryTask;
  // Only meaningful for the create form (no `task`) — the personal "task
  // defaults" preference, not applied when editing an existing story task.
  defaultPriority?: string;
  defaultTagId?: string | null;
}) {
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
          defaultValue={task?.priority ?? defaultPriority ?? "MEDIUM"}
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
      <TagPicker
        defaultTag={task?.tag ?? null}
        defaultTagId={defaultTagId}
        idPrefix={`story-tag-${task?.id ?? "new"}`}
      />
    </>
  );
}
