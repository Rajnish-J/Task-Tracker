"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { ACTION_VALUES, RESOURCE_VALUES, type Action, type Resource } from "@/lib/db/schema";

export const RESOURCE_LABELS: Record<Resource, string> = {
  project: "Project",
  section: "Section",
  column: "Column",
  task: "Task / Card",
};

export const ACTION_LABELS: Record<Action, string> = {
  create: "Create",
  update: "Update",
  delete: "Delete",
};

export type PermissionKey = `${Resource}:${Action}`;

export function permissionKey(resource: Resource, action: Action): PermissionKey {
  return `${resource}:${action}`;
}

// Reusable 4x3 grid of Project/Section/Column/Task x Create/Update/Delete
// checkboxes. `checked` decides each cell's state; `onToggle` fires with the
// next boolean for that (resource, action) pair.
export function PermissionGrid({
  checked,
  onToggle,
  disabled,
}: {
  checked: (resource: Resource, action: Action) => boolean;
  onToggle: (resource: Resource, action: Action, next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <table className="w-full table-fixed rounded-md border text-sm">
      <thead>
        <tr className="divide-x divide-border bg-muted/30">
          <th className="w-32 py-2 pl-3 text-left font-medium text-muted-foreground" />
          {ACTION_VALUES.map((action) => (
            <th key={action} className="px-3 py-2 text-left font-medium text-muted-foreground">
              {ACTION_LABELS[action]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {RESOURCE_VALUES.map((resource) => (
          <tr key={resource} className="divide-x divide-border">
            <td className="py-2 pl-3 font-medium">{RESOURCE_LABELS[resource]}</td>
            {ACTION_VALUES.map((action) => (
              <td key={action} className="px-3 py-2">
                <Checkbox
                  checked={checked(resource, action)}
                  disabled={disabled}
                  onCheckedChange={(value) => onToggle(resource, action, value)}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
