"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";

import { deleteSection, updateSection } from "@/app/actions";
import { SectionForm } from "@/components/section-form";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TagOption = { id: string; name: string; color: string };

type SectionRowMenuProps = {
  section: {
    id: string;
    name: string;
    description: string | null;
    parentId: string | null;
    tag: TagOption | null;
  };
  // Flattened section list for the parent picker. The caller excludes this
  // section and its descendants so a section can't be nested under itself.
  sections: { id: string; label: string }[];
};

// Per-section actions in the sidebar: edit (name, description, parent, tag) and
// delete. Mirrors ProjectRowMenu so section rows get the same affordances.
export function SectionRowMenu({ section, sections }: SectionRowMenuProps) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  // Keep the trigger from activating the row's link.
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${section.name}`}
              title="Section actions"
              onClick={stop}
              onPointerDown={stop}
              className="absolute right-1 top-1.5 size-6 text-sidebar-foreground/60 hover:text-sidebar-foreground"
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="right" className="w-48">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit section</DialogTitle>
            <DialogDescription>
              Update this section&apos;s name, description, parent, and tag.
            </DialogDescription>
          </DialogHeader>
          <SectionForm
            action={async (formData) => {
              await updateSection(formData);
              setEditOpen(false);
            }}
            sectionId={section.id}
            sections={sections}
            defaultName={section.name}
            defaultDescription={section.description ?? ""}
            defaultParentId={section.parentId ?? ""}
            defaultTag={section.tag}
            idPrefix={`edit-section-${section.id}`}
            submitLabel="Save changes"
            pendingLabel="Saving..."
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete section</DialogTitle>
            <DialogDescription>
              This deletes <span className="font-medium">{section.name}</span>. Its sub-sections are
              promoted to the top level and its projects are ungrouped — no boards or cards are lost.
            </DialogDescription>
          </DialogHeader>
          <form action={deleteSection} className="space-y-4">
            <input type="hidden" name="sectionId" value={section.id} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <SubmitButton
                variant="ghost"
                pendingLabel="Deleting..."
                className="text-destructive hover:text-destructive"
              >
                Delete section
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
