"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { createProject } from "@/app/actions";
import { ProjectForm } from "@/components/project-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type CreateProjectDialogProps = {
  trigger?: React.ReactElement;
  // Optional section assignment: pass the flattened section list to show a
  // picker, and a default to preselect (e.g. when creating from a section page).
  sections?: { id: string; label: string }[];
  defaultSectionId?: string;
};

export function CreateProjectDialog({ trigger, sections, defaultSectionId }: CreateProjectDialogProps) {
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
        <ProjectForm
          action={createProject}
          sections={sections}
          defaultSectionId={defaultSectionId}
          idPrefix="project"
          submitLabel="Create project"
          pendingLabel="Creating project..."
          errorMessage="Couldn't create project. Please try again."
        />
      </DialogContent>
    </Dialog>
  );
}
