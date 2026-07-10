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
    <table className="text-sm">
      <thead>
        <tr>
          <th className="w-32 text-left font-medium text-muted-foreground" />
          {ACTION_VALUES.map((action) => (
            <th key={action} className="px-3 pb-1 text-left font-medium text-muted-foreground">
              {ACTION_LABELS[action]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {RESOURCE_VALUES.map((resource) => (
          <tr key={resource}>
            <td className="pr-3 py-1 font-medium">{RESOURCE_LABELS[resource]}</td>
            {ACTION_VALUES.map((action) => (
              <td key={action} className="px-3 py-1">
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
