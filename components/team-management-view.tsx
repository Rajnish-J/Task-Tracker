"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  type ColumnDef,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";

import { grantMemberPermissions, revokeMemberPermissions } from "@/app/team-permission-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ACTION_VALUES, type Action, RESOURCE_VALUES, type Resource } from "@/lib/db/schema";
import { initials } from "@/lib/utils/initials";
import type { TeamDetail } from "@/lib/team-data";

const RESOURCE_LABELS: Record<Resource, string> = {
  project: "Project",
  section: "Section",
  column: "Column",
  task: "Task / Card",
};

const ACTION_LABELS: Record<Action, string> = {
  create: "Create",
  update: "Update",
  delete: "Delete",
};

type Member = TeamDetail["members"][number];
type PermissionKey = `${Resource}:${Action}`;

function permissionKey(resource: Resource, action: Action): PermissionKey {
  return `${resource}:${action}`;
}

function rehydrateGrid(memberPermissions: TeamDetail["memberPermissions"]) {
  const map = new Map<string, Set<PermissionKey>>();
  for (const [userId, pairs] of Object.entries(memberPermissions)) {
    map.set(userId, new Set(pairs as PermissionKey[]));
  }
  return map;
}

// Reusable 4x3 grid of Project/Section/Column/Task x Create/Update/Delete
// checkboxes. `checked` decides each cell's state; `onToggle` fires with the
// next boolean for that (resource, action) pair.
function PermissionGrid({
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

export function TeamManagementView({ team }: { team: TeamDetail }) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  const [bulkPending, startBulkTransition] = React.useTransition();

  const nonOwnerMembers = React.useMemo(
    () => team.members.filter((member) => member.role !== "owner"),
    [team.members],
  );

  const [localGrid, setLocalGrid] = React.useState(() => rehydrateGrid(team.memberPermissions));
  React.useEffect(() => {
    setLocalGrid(rehydrateGrid(team.memberPermissions));
  }, [team.memberPermissions]);

  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = React.useState<ExpandedState>({});
  const [bulkChecked, setBulkChecked] = React.useState<Set<PermissionKey>>(new Set());

  function toggleSingle(userId: string, resource: Resource, action: Action, next: boolean) {
    const key = permissionKey(resource, action);
    setLocalGrid((prev) => {
      const copy = new Map(prev);
      const set = new Set(copy.get(userId) ?? []);
      if (next) set.add(key);
      else set.delete(key);
      copy.set(userId, set);
      return copy;
    });

    startTransition(async () => {
      try {
        const run = next ? grantMemberPermissions : revokeMemberPermissions;
        await run({ teamId: team.id, userIds: [userId], pairs: [{ resource, action }] });
        router.refresh();
      } catch {
        setLocalGrid((prev) => {
          const copy = new Map(prev);
          const set = new Set(copy.get(userId) ?? []);
          if (next) set.delete(key);
          else set.add(key);
          copy.set(userId, set);
          return copy;
        });
      }
    });
  }

  const columns = React.useMemo<ColumnDef<Member>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllRowsSelected()}
            indeterminate={!table.getIsAllRowsSelected() && table.getIsSomeRowsSelected()}
            onCheckedChange={(value) => table.toggleAllRowsSelected(value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
      },
      {
        id: "member",
        header: "Member",
        cell: ({ row }) => {
          const member = row.original;
          return (
            <div className="flex items-center gap-3">
              <Avatar className="size-8">
                {member.user.image ? (
                  <AvatarImage src={member.user.image} alt={member.user.name} />
                ) : null}
                <AvatarFallback>{initials(member.user.name, member.user.email)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {member.user.name}
                  {member.user.id === team.currentUserId ? (
                    <span className="text-muted-foreground"> (you)</span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
              </div>
            </div>
          );
        },
      },
      {
        id: "expand",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => row.toggleExpanded()}
            aria-label={row.getIsExpanded() ? "Collapse permissions" : "Expand permissions"}
          >
            {row.getIsExpanded() ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </Button>
        ),
      },
    ],
    [team.currentUserId],
  );

  const table = useReactTable({
    data: nonOwnerMembers,
    columns,
    getRowId: (row) => row.user.id,
    state: { rowSelection, expanded },
    onRowSelectionChange: setRowSelection,
    onExpandedChange: setExpanded,
    getRowCanExpand: () => true,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const selectedRows = table.getSelectedRowModel().rows;

  function applyBulk(next: boolean) {
    const pairs = [...bulkChecked].map((key) => {
      const [resource, action] = key.split(":") as [Resource, Action];
      return { resource, action };
    });
    if (pairs.length === 0 || selectedRows.length === 0) return;
    const userIds = selectedRows.map((row) => row.original.user.id);

    startBulkTransition(async () => {
      const run = next ? grantMemberPermissions : revokeMemberPermissions;
      await run({ teamId: team.id, userIds, pairs });
      setRowSelection({});
      setBulkChecked(new Set());
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        You (owner) have full access to everything in this team. Grant or revoke permissions for
        other members below.
      </p>

      {selectedRows.length >= 2 ? (
        <div className="space-y-3 rounded-md border border-border/60 bg-muted/30 p-4">
          <p className="text-sm font-medium">{selectedRows.length} members selected</p>
          <PermissionGrid
            checked={(resource, action) => bulkChecked.has(permissionKey(resource, action))}
            onToggle={(resource, action, next) => {
              setBulkChecked((prev) => {
                const copy = new Set(prev);
                const key = permissionKey(resource, action);
                if (next) copy.add(key);
                else copy.delete(key);
                return copy;
              });
            }}
            disabled={bulkPending}
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={bulkPending} onClick={() => applyBulk(true)}>
              {bulkPending ? "Applying…" : "Grant selected"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={bulkPending}
              onClick={() => applyBulk(false)}
            >
              {bulkPending ? "Applying…" : "Revoke selected"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <React.Fragment key={row.id}>
                  <TableRow data-state={row.getIsSelected() ? "selected" : undefined}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {row.getIsExpanded() ? (
                    <TableRow>
                      <TableCell colSpan={row.getVisibleCells().length} className="bg-muted/20">
                        <PermissionGrid
                          checked={(resource, action) =>
                            localGrid.get(row.original.user.id)?.has(permissionKey(resource, action)) ??
                            false
                          }
                          onToggle={(resource, action, next) =>
                            toggleSingle(row.original.user.id, resource, action, next)
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No other members yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
