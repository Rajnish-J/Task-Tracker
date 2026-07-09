"use client";

import * as React from "react";
import { Settings2 } from "lucide-react";

import { deleteColumn, updateColumn } from "@/app/actions";
import { SpaceField } from "@/components/space-context";
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
import { AccentSelect } from "@/components/accent-select";
import { COLUMN_COLOR_OPTIONS } from "@/lib/constants";

type ProjectColumns = {
  id: string;
  name: string;
  columns: {
    id: string;
    name: string;
    color: string | null;
    tasks: { id: string }[];
  }[];
};

export function ManageColumnsDialog({ project }: { project: ProjectColumns }) {
  const [open, setOpen] = React.useState(false);
  const [colors, setColors] = React.useState<Record<string, string>>(
    Object.fromEntries(
      project.columns.map((column) => [column.id, column.color ?? COLUMN_COLOR_OPTIONS[0]]),
    ),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="gap-2 shadow-sm">
          <Settings2 className="size-4" />
          Manage Columns
          </Button>
        }
      />
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Manage columns</DialogTitle>
          <DialogDescription>
            Rename stages, swap accents, or remove a stage. Tasks from a removed column move into the next available column.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {project.columns.map((column) => (
            <div key={column.id} className="rounded-lg border border-border/60 p-4">
              <form action={updateColumn} className="grid gap-4 sm:grid-cols-[1fr_200px_auto]">
                <SpaceField />
                <input type="hidden" name="projectId" value={project.id} />
                <input type="hidden" name="columnId" value={column.id} />
                <input type="hidden" name="color" value={colors[column.id]} />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input name="name" defaultValue={column.name} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Accent</label>
                  <AccentSelect
                    value={colors[column.id]}
                    onValueChange={(value) =>
                      setColors((current) => ({
                        ...current,
                        [column.id]: value,
                      }))
                    }
                  />
                </div>
                <div className="flex items-end justify-end">
                  <SubmitButton variant="secondary" pendingLabel="Saving...">
                    Save
                  </SubmitButton>
                </div>
              </form>
              <div className="mt-3 flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">{column.tasks.length} tasks in this column</p>
                <form action={deleteColumn}>
                  <SpaceField />
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="hidden" name="columnId" value={column.id} />
                  <SubmitButton variant="ghost" pendingLabel="Removing..." className="text-destructive hover:text-destructive">
                    Remove column
                  </SubmitButton>
                </form>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
