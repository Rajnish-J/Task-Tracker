"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { createProject } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
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
import { Textarea } from "@/components/ui/textarea";

type CreateProjectDialogProps = {
  trigger?: React.ReactElement;
};

export function CreateProjectDialog({ trigger }: CreateProjectDialogProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
          <Button className="w-full justify-start gap-2">
            <Plus className="size-4" />
            New Project
          </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Spin up a fresh Kanban workspace with default columns and its own task flow.
          </DialogDescription>
        </DialogHeader>
        <form action={createProject} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="project-name">
              Project name
            </label>
            <Input id="project-name" name="name" placeholder="Website redesign" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="project-description">
              Description
            </label>
            <Textarea
              id="project-description"
              name="description"
              rows={4}
              placeholder="Scope, delivery notes, or how this board will be used."
            />
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Creating project...">Create project</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
