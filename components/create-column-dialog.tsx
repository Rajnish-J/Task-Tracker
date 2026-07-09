"use client";

import * as React from "react";
import { Columns3, Plus } from "lucide-react";

import { createColumn } from "@/app/actions";
import { SpaceField } from "@/components/space-context";
import { SubmitButton } from "@/components/submit-button";
import { COLUMN_COLOR_OPTIONS } from "@/lib/constants";
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

export function CreateColumnDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = React.useState(false);
  const [color, setColor] = React.useState<string>(COLUMN_COLOR_OPTIONS[0]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="gap-2 shadow-sm">
          <Columns3 className="size-4" />
          Add Column
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add column</DialogTitle>
          <DialogDescription>
            Create a new workflow stage for this project board.
          </DialogDescription>
        </DialogHeader>
        <form action={createColumn} className="space-y-4">
          <SpaceField />
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="color" value={color} />
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="column-name">
              Column name
            </label>
            <Input id="column-name" name="name" placeholder="Blocked" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Accent</label>
            <AccentSelect
              value={color}
              onValueChange={setColor}
              placeholder="Select a column accent"
            />
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Adding column...">
              <Plus className="size-4" />
              Add column
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
