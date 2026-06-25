"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { createTask } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { PRIORITY_OPTIONS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ColumnOption = {
  id: string;
  name: string;
};

type CreateTaskDialogProps = {
  projectId: string;
  columnId?: string;
  columns: ColumnOption[];
  trigger?: React.ReactElement;
};

export function CreateTaskDialog({
  projectId,
  columnId,
  columns,
  trigger,
}: CreateTaskDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedColumn, setSelectedColumn] = React.useState<string>(columnId ?? columns[0]?.id ?? "");
  const [priority, setPriority] = React.useState<string>("MEDIUM");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
          <Button className="gap-2">
            <Plus className="size-4" />
            New Task
          </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-xl" key={`${columnId ?? "all"}-${columns[0]?.id ?? "none"}`}>
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
          <DialogDescription>
            Add a task to this project and place it in the right Kanban column.
          </DialogDescription>
        </DialogHeader>
        <form action={createTask} className="space-y-4">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="columnId" value={selectedColumn} />
          <input type="hidden" name="priority" value={priority} />
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="task-title">
              Task title <span className="text-destructive">*</span>
            </label>
            <Input id="task-title" name="title" placeholder="Prepare launch checklist" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="task-short-description">
              Collaborators
            </label>
            <Input
              id="task-short-description"
              name="shortDescription"
              maxLength={160}
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
              <Select value={priority} onValueChange={(value) => value && setPriority(value)}>
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
            <label className="text-sm font-medium" htmlFor="task-description">
              Description
            </label>
            <Textarea
              id="task-description"
              name="description"
              rows={4}
              placeholder="Context, acceptance criteria, or links."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="task-notes">
              Notes
            </label>
            <Textarea id="task-notes" name="notes" rows={3} placeholder="Personal notes or meeting summary." />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="task-due-date">
              Due date
            </label>
            <Input id="task-due-date" name="dueDate" type="date" />
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Creating task...">Create task</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
