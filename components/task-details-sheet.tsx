"use client";

import * as React from "react";
import { format } from "date-fns";
import { Check, Pencil } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { deleteTask, updateTask } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { SpaceField } from "@/components/space-context";
import { StoryTasksPanel } from "@/components/story-tasks-panel";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type ColumnOption = {
  id: string;
  name: string;
};

type Tag = { id: string; name: string; color: string };

type TaskDetailsSheetProps = {
  projectId: string;
  task: {
    id: string;
    title: string;
    shortDescription: string | null;
    description: string | null;
    notes: string | null;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    dueDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
    columnId: string;
    tag?: Tag | null;
    storyTasks: {
      id: string;
      title: string;
      description: string | null;
      priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      dueDate: Date | null;
      isDone: boolean;
      tag?: Tag | null;
    }[];
  } | null;
  columns: ColumnOption[];
};

export function TaskDetailsSheet({
  projectId,
  task,
  columns,
}: TaskDetailsSheetProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("edit") === "1" ? "edit" : "view";

  return (
    <Dialog open={Boolean(task)} onOpenChange={(open) => !open && router.replace(pathname)}>
      <DialogContent className="max-h-[90vh] w-full overflow-y-auto sm:max-w-3xl">
        {task ? (
          <TaskDetailsForm
            key={`${task.id}-${initialMode}`}
            projectId={projectId}
            task={task}
            columns={columns}
            initialMode={initialMode}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TaskDetailsForm({
  projectId,
  task,
  columns,
  initialMode,
}: {
  projectId: string;
  task: NonNullable<TaskDetailsSheetProps["task"]>;
  columns: ColumnOption[];
  initialMode: "view" | "edit";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = React.useState<"view" | "edit">(initialMode);
  const [selectedColumn, setSelectedColumn] = React.useState<string>(task.columnId);
  const [selectedPriority, setSelectedPriority] = React.useState<string>(task.priority);

  const statusName =
    columns.find((column) => column.id === task.columnId)?.name ?? "—";

  return (
    <>
      <DialogHeader className="space-y-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {PRIORITY_OPTIONS.find((option) => option.value === task.priority)?.label}
          </Badge>
          <Badge variant="outline">User story</Badge>
          {task.tag ? <TagBadge tag={task.tag} /> : null}
        </div>
        <DialogTitle className="text-left text-2xl">{task.title}</DialogTitle>
        <DialogDescription className="text-left">
          Created {format(task.createdAt, "MMM d, yyyy")} and last updated{" "}
          {format(task.updatedAt, "MMM d, yyyy")}.
        </DialogDescription>
      </DialogHeader>

      {mode === "view" ? (
        <TaskDetailsView
          task={task}
          statusName={statusName}
          onEdit={() => setMode("edit")}
          onClose={() => router.replace(pathname)}
        />
      ) : (
      <>
      <ActionForm
        action={updateTask}
        successMessage="Task saved"
        errorMessage="Couldn't save task. Please try again."
        className="mt-6 space-y-5"
      >
        <SpaceField />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="taskId" value={task.id} />
        <input type="hidden" name="columnId" value={selectedColumn} />
        <input type="hidden" name="priority" value={selectedPriority} />
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="task-detail-title">
            Title <span className="text-destructive">*</span>
          </label>
          <Input id="task-detail-title" name="title" defaultValue={task.title} required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="task-detail-short-description">
            Collaborators
          </label>
          <Input
            id="task-detail-short-description"
            name="shortDescription"
            maxLength={160}
            defaultValue={task.shortDescription ?? ""}
            placeholder="Who you're working with or learning from on this."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Status <span className="text-destructive">*</span>
            </label>
            <Select
              value={selectedColumn}
              onValueChange={(value) => value && setSelectedColumn(value)}
              items={columns.map((column) => ({ label: column.name, value: column.id }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a column" />
              </SelectTrigger>
              <SelectContent>
                {columns.map((column) => (
                  <SelectItem key={column.id} value={column.id}>
                    {column.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Priority <span className="text-destructive">*</span>
            </label>
            <Select value={selectedPriority} onValueChange={(value) => value && setSelectedPriority(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
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
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="task-detail-due-date">
            Due date
          </label>
          <Input
            id="task-detail-due-date"
            name="dueDate"
            type="date"
            defaultValue={task.dueDate ? format(task.dueDate, "yyyy-MM-dd") : ""}
          />
        </div>
        <TagPicker defaultTag={task.tag ?? null} idPrefix={`task-detail-tag-${task.id}`} />
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="task-detail-description">
            Description
          </label>
          <Textarea
            id="task-detail-description"
            name="description"
            defaultValue={task.description ?? ""}
            rows={6}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="task-detail-notes">
            Notes
          </label>
          <Textarea id="task-detail-notes" name="notes" defaultValue={task.notes ?? ""} rows={8} />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
          <Button type="button" variant="outline" onClick={() => setMode("view")}>
            Cancel
          </Button>
          <SubmitButton variant="secondary" pendingLabel="Saving task...">
            Save changes
          </SubmitButton>
        </div>
      </ActionForm>

      <div className="mt-6">
        <StoryTasksPanel projectId={projectId} storyId={task.id} storyTasks={task.storyTasks} />
      </div>

      <ActionForm
        action={deleteTask}
        errorMessage="Couldn't delete task. Please try again."
        className="mt-3"
      >
        <SpaceField />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="taskId" value={task.id} />
        <SubmitButton variant="ghost" className="text-destructive hover:text-destructive">
          Delete task
        </SubmitButton>
      </ActionForm>
      </>
      )}
    </>
  );
}

function TaskDetailsView({
  task,
  statusName,
  onEdit,
  onClose,
}: {
  task: NonNullable<TaskDetailsSheetProps["task"]>;
  statusName: string;
  onEdit: () => void;
  onClose: () => void;
}) {
  const priorityLabel = PRIORITY_OPTIONS.find((option) => option.value === task.priority)?.label;

  return (
    <div className="mt-6 space-y-6">
      <dl className="grid gap-4 sm:grid-cols-2">
        <Field label="Status">{statusName}</Field>
        <Field label="Priority">{priorityLabel ?? "—"}</Field>
        <Field label="Due date">
          {task.dueDate ? format(task.dueDate, "MMM d, yyyy") : "—"}
        </Field>
        <Field label="Tag">{task.tag ? <TagBadge tag={task.tag} /> : "—"}</Field>
        <div className="sm:col-span-2">
          <Field label="Collaborators">{task.shortDescription || "—"}</Field>
        </div>
      </dl>

      <ReadOnlyText label="Description" value={task.description} />
      <ReadOnlyText label="Notes" value={task.notes} />

      {task.storyTasks.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Subtasks</p>
          <ul className="space-y-1.5">
            {task.storyTasks.map((story) => (
              <li key={story.id} className="flex items-center gap-2 text-sm">
                <span
                  className={
                    "flex size-4 shrink-0 items-center justify-center rounded-md border " +
                    (story.isDone
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-transparent")
                  }
                >
                  {story.isDone ? <Check className="size-3" strokeWidth={3} /> : null}
                </span>
                <span className={story.isDone ? "text-muted-foreground line-through" : ""}>
                  {story.title}
                </span>
                {story.tag ? <TagBadge tag={story.tag} /> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button type="button" variant="secondary" onClick={onEdit}>
          <Pencil className="size-4" /> Edit
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function ReadOnlyText({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-sm whitespace-pre-wrap text-muted-foreground">
        {value?.trim() ? value : "—"}
      </p>
    </div>
  );
}
