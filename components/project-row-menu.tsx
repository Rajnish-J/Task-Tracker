"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";

import { deleteProject, moveProjectToSection, updateProject } from "@/app/actions";
import { ProjectForm } from "@/components/project-form";
import { SpaceField, useSpace } from "@/components/space-context";
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TagOption = { id: string; name: string; color: string };

type ProjectRowMenuProps = {
  project: {
    id: string;
    name: string;
    description: string | null;
    sectionId: string | null;
    tag: TagOption | null;
  };
  sections: { id: string; label: string }[];
  currentSectionId?: string | null;
};

// Per-project actions in the sidebar: rename, move to a section (or ungroup),
// and delete. Used by both nav-projects and nav-sections rows.
export function ProjectRowMenu({ project, sections, currentSectionId }: ProjectRowMenuProps) {
  const router = useRouter();
  const { teamId } = useSpace();
  const [, startTransition] = React.useTransition();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  // Keep the trigger from activating the row's link or starting a drag.
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${project.name}`}
              title="Project actions"
              onClick={stop}
              onPointerDown={stop}
              className="absolute right-1 top-1/2 size-6 -translate-y-1/2 text-sidebar-foreground/60 hover:text-sidebar-foreground"
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="right" className="w-48">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit</DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Move to section</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="thin-scrollbar max-h-72 w-56 overflow-y-auto">
              <DropdownMenuRadioGroup
                value={currentSectionId ?? ""}
                onValueChange={(value) =>
                  startTransition(async () => {
                    await moveProjectToSection(
                      {
                        projectId: project.id,
                        sectionId: (value as string) || null,
                      },
                      teamId ?? undefined,
                    );
                    router.refresh();
                  })
                }
              >
                <DropdownMenuRadioItem value="">Ungroup (no section)</DropdownMenuRadioItem>
                {sections.map((section) => (
                  <DropdownMenuRadioItem key={section.id} value={section.id}>
                    {section.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>
              Update this project&apos;s name, description, section, and tag.
            </DialogDescription>
          </DialogHeader>
          <ProjectForm
            action={async (formData) => {
              await updateProject(formData);
              setEditOpen(false);
            }}
            projectId={project.id}
            sections={sections}
            defaultName={project.name}
            defaultDescription={project.description ?? ""}
            defaultSectionId={project.sectionId ?? ""}
            defaultTag={project.tag}
            idPrefix={`edit-project-${project.id}`}
            submitLabel="Save changes"
            pendingLabel="Saving..."
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
            <DialogDescription>
              This permanently deletes <span className="font-medium">{project.name}</span> and all of
              its columns and cards. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <form action={deleteProject} className="space-y-4">
            <SpaceField />
            <input type="hidden" name="projectId" value={project.id} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <SubmitButton
                variant="ghost"
                pendingLabel="Deleting..."
                className="text-destructive hover:text-destructive"
              >
                Delete project
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
