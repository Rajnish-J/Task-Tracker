"use client";

import * as React from "react";
import { FolderTree, Plus } from "lucide-react";

import { createSection } from "@/app/actions";
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

const selectClassName =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

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
        <form action={createSection} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="section-name">
              Section name
            </label>
            <Input id="section-name" name="name" placeholder="AI Engineer" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="section-description">
              Description
            </label>
            <Textarea
              id="section-description"
              name="description"
              rows={3}
              placeholder="What this group of projects is about."
            />
          </div>
          {sections && sections.length > 0 ? (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="section-parent">
                Parent section
              </label>
              <select
                id="section-parent"
                name="parentId"
                defaultValue={defaultParentId ?? ""}
                className={selectClassName}
              >
                <option value="">Top level (no parent)</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Creating section...">
              <Plus className="size-4" />
              Create section
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
