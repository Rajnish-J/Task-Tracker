"use client";

import * as React from "react";
import { FolderTree, Plus } from "lucide-react";

import { createSection } from "@/app/actions";
import { SectionForm } from "@/components/section-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type CreateSectionDialogProps = {
  trigger?: React.ReactElement;
  // Flattened section list ("Parent / Child" labels) for the optional parent
  // picker, and a default to preselect (e.g. creating a sub-section).
  sections?: { id: string; label: string }[];
  defaultParentId?: string;
};

export function CreateSectionDialog({ trigger, sections, defaultParentId }: CreateSectionDialogProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline" className="justify-start gap-2">
              <FolderTree className="size-4" />
              New Section
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create section</DialogTitle>
          <DialogDescription>
            Group related projects. A section can nest inside another section and shows a combined
            board of every card in its subtree.
          </DialogDescription>
        </DialogHeader>
        <SectionForm
          action={createSection}
          onSuccess={() => setOpen(false)}
          errorMessage="Couldn't create section. Please try again."
          sections={sections}
          defaultParentId={defaultParentId}
          idPrefix="create-section"
          submitLabel={
            <>
              <Plus className="size-4" />
              Create section
            </>
          }
          pendingLabel="Creating section..."
        />
      </DialogContent>
    </Dialog>
  );
}
