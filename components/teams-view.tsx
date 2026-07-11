"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowUpRight, MoreHorizontal, Pencil, Trash2, Users } from "lucide-react";

import { deleteTeam, updateTeam } from "@/app/team-actions";
import { ActionForm } from "@/components/action-form";
import { AccentSelect } from "@/components/accent-select";
import { CreateTeamDialog } from "@/components/create-team-dialog";
import { IconSelect } from "@/components/icon-select";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HeaderBreadcrumb } from "@/components/header-slots";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  TEAM_COLOR_META,
  TEAM_COLOR_OPTIONS,
  TEAM_CREATION_LIMIT,
  TEAM_ICON_OPTIONS,
} from "@/lib/constants";
import { TeamIcon } from "@/lib/team-icons";
import type { getTeamsOverview } from "@/lib/team-data";

type TeamsOverview = Awaited<ReturnType<typeof getTeamsOverview>>;
type Team = TeamsOverview["teams"][number];

// Teams overview: every team the user belongs to, plus the create flow.
export function TeamsView({
  overview,
  autoOpenCreate,
}: {
  overview: TeamsOverview;
  autoOpenCreate?: boolean;
}) {
  const { teams, canCreateTeam } = overview;
  const [editTarget, setEditTarget] = React.useState<Team | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Team | null>(null);

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <HeaderBreadcrumb>
        <span>Workspace</span>
        <span>/</span>
        <span className="text-foreground">Teams</span>
      </HeaderBreadcrumb>
      <header className="shrink-0 border-b border-border/60 bg-background/80 px-4 py-4 backdrop-blur md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
              <Badge variant="secondary">{teams.length} teams</Badge>
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Shared workspaces with their own projects, sections and boards. Switch spaces any
              time from the sidebar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CreateTeamDialog canCreateTeam={canCreateTeam} defaultOpen={autoOpenCreate} />
          </div>
        </div>
        {!canCreateTeam ? (
          <p className="mt-3 text-xs text-muted-foreground">
            You&apos;ve reached the limit of {TEAM_CREATION_LIMIT} created teams. Delete a team you
            own to free a slot.
          </p>
        ) : null}
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {teams.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md space-y-3 rounded-lg border border-dashed border-border/60 p-10 text-center">
              <Users className="mx-auto size-8 text-muted-foreground" />
              <h2 className="text-lg font-semibold">No teams yet</h2>
              <p className="text-sm text-muted-foreground">
                Create a team to collaborate on shared boards, or accept an invitation from the
                notification bell when a teammate invites you.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => {
              const swatch = team.color ? TEAM_COLOR_META[team.color]?.swatch : undefined;
              const isOwner = team.role === "owner";
              return (
                <Card key={team.id} className="relative transition hover:border-primary/40 hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2.5">
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-white ${swatch ?? "bg-primary"}`}
                      >
                        <TeamIcon icon={team.icon} className="size-4" />
                      </span>
                      <Link href={`/teams/${team.id}`} className="min-w-0 flex-1 truncate hover:underline">
                        {team.name}
                        <span className="absolute inset-0" aria-hidden />
                      </Link>
                      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
                      {isOwner ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="relative z-10 shrink-0"
                                aria-label={`Actions for ${team.name}`}
                              />
                            }
                          >
                            <MoreHorizontal className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditTarget(team)}>
                              <Pencil className="size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget(team)}
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
                      {team.description?.trim() || "No description yet."}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={team.role === "owner" ? "default" : "secondary"}>
                        {team.role}
                      </Badge>
                      <span>
                        {team.memberCount} {team.memberCount === 1 ? "member" : "members"}
                      </span>
                      <span>·</span>
                      <span>Created {format(team.createdAt, "MMM d, yyyy")}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit team */}
      {editTarget ? (
        <EditTeamDialog
          key={editTarget.id}
          team={editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          onSuccess={() => setEditTarget(null)}
        />
      ) : null}

      {/* Delete team confirm */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete team</DialogTitle>
            <DialogDescription>
              This permanently deletes <span className="font-medium">{deleteTarget?.name}</span>,
              including every project, section, board and card in it. Members are notified. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <ActionForm
            action={deleteTeam}
            errorMessage="Couldn't delete team. Please try again."
            className="space-y-4"
          >
            <input type="hidden" name="teamId" value={deleteTarget?.id ?? ""} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <SubmitButton
                variant="ghost"
                pendingLabel="Deleting…"
                className="text-destructive hover:text-destructive"
              >
                Delete team
              </SubmitButton>
            </DialogFooter>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditTeamDialog({
  team,
  onOpenChange,
  onSuccess,
}: {
  team: Team;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [color, setColor] = React.useState<string>(team.color ?? TEAM_COLOR_OPTIONS[0]);
  const [icon, setIcon] = React.useState<string>(team.icon ?? TEAM_ICON_OPTIONS[0]);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit team</DialogTitle>
          <DialogDescription>Rename the team or update its description.</DialogDescription>
        </DialogHeader>
        <ActionForm
          action={updateTeam}
          successMessage="Team updated"
          errorMessage="Couldn't update team. Please try again."
          onSuccess={onSuccess}
          className="space-y-4"
        >
          <input type="hidden" name="teamId" value={team.id} />
          <input type="hidden" name="color" value={color} />
          <input type="hidden" name="icon" value={icon} />
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="edit-team-name">
              Team name
            </label>
            <Input
              id="edit-team-name"
              name="name"
              defaultValue={team.name}
              required
              minLength={2}
              maxLength={80}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="edit-team-description">
              Description
            </label>
            <Textarea
              id="edit-team-description"
              name="description"
              defaultValue={team.description ?? ""}
              maxLength={240}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Icon</label>
            <IconSelect value={icon} onValueChange={setIcon} placeholder="Team icon" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Accent</label>
            <AccentSelect value={color} onValueChange={setColor} placeholder="Team accent" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
