"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";

import { grantMemberPermissions, revokeMemberPermissions } from "@/app/team-permission-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PermissionGrid, permissionKey, type PermissionKey } from "@/components/team-permission-grid";
import { TeamManageAccessDialog } from "@/components/team-manage-access-dialog";
import type { Action, Resource } from "@/lib/db/schema";
import { initials } from "@/lib/utils/initials";
import type { TeamDetail } from "@/lib/team-data";

type Member = TeamDetail["members"][number];

export function TeamManagementView({ team }: { team: TeamDetail }) {
  const router = useRouter();
  const [bulkPending, startBulkTransition] = React.useTransition();

  const nonOwnerMembers = React.useMemo(
    () => team.members.filter((member) => member.role !== "owner"),
    [team.members],
  );

  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});
  const [bulkChecked, setBulkChecked] = React.useState<Set<PermissionKey>>(new Set());
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [manageAccessMember, setManageAccessMember] = React.useState<Member | null>(null);

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
        id: "role",
        header: "Role",
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.original.role}
          </Badge>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: () => (
          <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            Active
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${row.original.user.name}`}
                />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setManageAccessMember(row.original)}>
                Manage Access
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [team.currentUserId],
  );

  const table = useReactTable({
    data: nonOwnerMembers,
    columns,
    getRowId: (row) => row.user.id,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
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
      setBulkOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        You (owner) have full access to everything in this team. Grant or revoke permissions for
        other members below — per member, or scoped to a specific project.
      </p>

      {selectedRows.length >= 2 ? (
        <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 p-3">
          <p className="text-sm font-medium">{selectedRows.length} members selected</p>
          <Button size="sm" onClick={() => setBulkOpen(true)}>
            Bulk edit default permissions
          </Button>
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
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
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

      {manageAccessMember ? (
        <TeamManageAccessDialog
          key={manageAccessMember.user.id}
          open={Boolean(manageAccessMember)}
          onOpenChange={(open) => !open && setManageAccessMember(null)}
          teamId={team.id}
          member={manageAccessMember}
          initialGrid={team.memberPermissions[manageAccessMember.user.id] ?? {}}
          projects={team.projects}
          sections={team.sections}
        />
      ) : null}

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk edit default permissions</DialogTitle>
            <DialogDescription>
              Applies to {selectedRows.length} selected members, across every project in this team.
            </DialogDescription>
          </DialogHeader>
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
          <div className="flex justify-end gap-2">
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
