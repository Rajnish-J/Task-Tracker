"use client";

import * as React from "react";
import { format } from "date-fns";
import { usePathname, useRouter } from "next/navigation";

import { deleteTask, updateTask } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
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

  return (
    <Dialog open={Boolean(task)} onOpenChange={(open) => !open && router.replace(pathname)}>
      <DialogContent className="max-h-[90vh] w-full overflow-y-auto sm:max-w-3xl">
        {task ? <TaskDetailsForm key={task.id} projectId={projectId} task={task} columns={columns} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function TaskDetailsForm({
  projectId,
  task,
  columns,
}: {
  projectId: string;
  task: NonNullable<TaskDetailsSheetProps["task"]>;
  columns: ColumnOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedColumn, setSelectedColumn] = React.useState<string>(task.columnId);
  const [selectedPriority, setSelectedPriority] = React.useState<string>(task.priority);

  return (
    <>
      <DialogHeader className="space-y-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {PRIORITY_OPTIONS.find((option) => option.value === task.priority)?.label}
          </Badge>
          <Badge variant="outline">Task details</Badge>
        </div>
        <DialogTitle className="text-left text-2xl">{task.title}</DialogTitle>
        <DialogDescription className="text-left">
          Created {format(task.createdAt, "MMM d, yyyy")} and last updated{" "}
          {format(task.updatedAt, "MMM d, yyyy")}.
        </DialogDescription>
      </DialogHeader>

      <form action={updateTask} className="mt-6 space-y-5">
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
          <Button type="button" variant="outline" onClick={() => router.replace(pathname)}>
            Close
          </Button>
          <SubmitButton variant="secondary" pendingLabel="Saving task...">
            Save changes
          </SubmitButton>
        </div>
      </form>

      <form action={deleteTask} className="mt-3">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="taskId" value={task.id} />
        <SubmitButton variant="ghost" className="text-destructive hover:text-destructive">
          Delete task
        </SubmitButton>
      </form>
    </>
  );
}
"use client";

import * as React from "react";
import { format } from "date-fns";
import { usePathname, useRouter } from "next/navigation";

import { deleteTask, updateTask } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
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

type TaskDetailsSheetProps = {
  projectId: string;
  task: {
    id: string;
    title: string;
    description: string | null;
    notes: string | null;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    dueDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
    columnId: string;
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

  return (
    <Dialog open={Boolean(task)} onOpenChange={(open) => !open && router.replace(pathname)}>
      <DialogContent className="max-h-[90vh] w-full overflow-y-auto sm:max-w-3xl">
        {task ? <TaskDetailsForm key={task.id} projectId={projectId} task={task} columns={columns} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function TaskDetailsForm({
  projectId,
  task,
  columns,
}: {
  projectId: string;
  task: NonNullable<TaskDetailsSheetProps["task"]>;
  columns: ColumnOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [selectedColumn, setSelectedColumn] = React.useState<string>(task.columnId);
  const [selectedPriority, setSelectedPriority] = React.useState<string>(task.priority);

  return (
    <>
      <DialogHeader className="space-y-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {PRIORITY_OPTIONS.find((option) => option.value === task.priority)?.label}
          </Badge>
          <Badge variant="outline">Task details</Badge>
        </div>
        <DialogTitle className="text-left text-2xl">{task.title}</DialogTitle>
        <DialogDescription className="text-left">
          Created {format(task.createdAt, "MMM d, yyyy")} and last updated{" "}
          {format(task.updatedAt, "MMM d, yyyy")}.
        </DialogDescription>
      </DialogHeader>

      <form action={updateTask} className="mt-6 space-y-5">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="taskId" value={task.id} />
        <input type="hidden" name="columnId" value={selectedColumn} />
        <input type="hidden" name="priority" value={selectedPriority} />
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="task-detail-title">
            Title
          </label>
          <Input id="task-detail-title" name="title" defaultValue={task.title} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
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
            <label className="text-sm font-medium">Priority</label>
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
          <Button type="button" variant="outline" onClick={() => router.replace(pathname)}>
            Close
          </Button>
          <SubmitButton variant="secondary" pendingLabel="Saving task...">
            Save changes
          </SubmitButton>
        </div>
      </form>

      <form action={deleteTask} className="mt-3">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="taskId" value={task.id} />
        <SubmitButton variant="ghost" className="text-destructive hover:text-destructive">
          Delete task
        </SubmitButton>
      </form>
    </>
  );
}
