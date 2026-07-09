"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { LogOut, Trash2, UserPlus } from "lucide-react";

import {
  cancelInvitation,
  deleteTeam,
  inviteMember,
  leaveTeam,
  removeMember,
  updateTeam,
} from "@/app/team-actions";
import { AccentSelect } from "@/components/accent-select";
import { MemberSearch } from "@/components/member-search";
import { SubmitButton } from "@/components/submit-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { TEAM_COLOR_OPTIONS } from "@/lib/constants";
import type { TeamDetail } from "@/lib/team-data";

function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : source.slice(0, 2)).toUpperCase();
}

// Team management: details (owner-editable), members (invite / remove /
// leave), pending invitations, and the owner's danger zone.
export function TeamSettingsView({ team }: { team: TeamDetail }) {
  const router = useRouter();
  const isOwner = team.role === "owner";
  const [color, setColor] = React.useState<string>(team.color ?? TEAM_COLOR_OPTIONS[0]);
  const [removeTarget, setRemoveTarget] = React.useState<TeamDetail["members"][number] | null>(null);
  const [leaveOpen, setLeaveOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [inviting, setInviting] = React.useState(false);

  const handleInvite = async (user: { id: string }) => {
    setInviting(true);
    setInviteError(null);
    try {
      await inviteMember({ teamId: team.id, inviteeId: user.id });
      router.refresh();
    } catch {
      setInviteError("Could not send the invitation. They may already be invited.");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border/60 bg-background/80 px-4 py-4 backdrop-blur md:px-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <SidebarTrigger className="-ml-1 text-foreground" />
            <span>{team.name}</span>
            <span>/</span>
            <span className="text-foreground">Team settings</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Team settings</h1>
            <Badge variant={isOwner ? "default" : "secondary"}>{team.role}</Badge>
            <Badge variant="secondary">{team.members.length} members</Badge>
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Created {format(team.createdAt, "MMM d, yyyy")}.
            {isOwner
              ? " As the owner you manage the team's details, members and structure."
              : " Only the team owner can change details or manage members."}
          </p>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
        {/* Team details */}
        <Card>
          <CardHeader>
            <CardTitle>Team details</CardTitle>
            <CardDescription>
              {isOwner ? "Rename the team or update its description." : "About this team."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isOwner ? (
              <form action={updateTeam} className="space-y-4">
                <input type="hidden" name="teamId" value={team.id} />
                <input type="hidden" name="color" value={color} />
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="team-settings-name">
                    Team name
                  </label>
                  <Input
                    id="team-settings-name"
                    name="name"
                    defaultValue={team.name}
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="team-settings-description">
                    Description
                  </label>
                  <Textarea
                    id="team-settings-description"
                    name="description"
                    defaultValue={team.description ?? ""}
                    maxLength={240}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Accent</label>
                  <AccentSelect value={color} onValueChange={setColor} placeholder="Team accent" />
                </div>
                <div className="flex justify-end">
                  <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
                </div>
              </form>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="font-medium">{team.name}</p>
                <p className="text-muted-foreground">
                  {team.description?.trim() || "No description yet."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Members */}
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              {isOwner
                ? "Invite teammates by email, or remove members from the team."
                : "Everyone with access to this team's boards."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {isOwner ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <UserPlus className="size-4" />
                  Invite a member
                </div>
                <MemberSearch
                  selected={[]}
                  onSelect={handleInvite}
                  onRemove={() => {}}
                  excludeTeamId={team.id}
                  placeholder={inviting ? "Sending invitation…" : "Search by email to invite…"}
                />
                {inviteError ? <p className="text-xs text-destructive">{inviteError}</p> : null}
              </div>
            ) : null}

            <ul className="divide-y divide-border/60 rounded-md border border-border/60">
              {team.members.map((member) => (
                <li key={member.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar className="size-8">
                    {member.user.image ? (
                      <AvatarImage src={member.user.image} alt={member.user.name} />
                    ) : null}
                    <AvatarFallback>{initials(member.user.name, member.user.email)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.user.name}
                      {member.user.id === team.currentUserId ? (
                        <span className="text-muted-foreground"> (you)</span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                  </div>
                  <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                    {member.role}
                  </Badge>
                  {isOwner && member.user.id !== team.currentUserId ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setRemoveTarget(member)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>

            {isOwner && team.pendingInvitations.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Pending invitations</p>
                <ul className="divide-y divide-border/60 rounded-md border border-dashed border-border/60">
                  {team.pendingInvitations.map((invitation) => (
                    <li key={invitation.id} className="flex items-center gap-3 px-3 py-2.5">
                      <Avatar className="size-8">
                        {invitation.invitee.image ? (
                          <AvatarImage src={invitation.invitee.image} alt={invitation.invitee.name} />
                        ) : null}
                        <AvatarFallback>
                          {initials(invitation.invitee.name, invitation.invitee.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{invitation.invitee.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Invited {formatDistanceToNow(invitation.createdAt, { addSuffix: true })}
                        </p>
                      </div>
                      <form action={cancelInvitation}>
                        <input type="hidden" name="invitationId" value={invitation.id} />
                        <input type="hidden" name="teamId" value={team.id} />
                        <SubmitButton variant="ghost" size="sm" pendingLabel="Canceling…">
                          Cancel
                        </SubmitButton>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {!isOwner ? (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  className="gap-2 text-destructive hover:text-destructive"
                  onClick={() => setLeaveOpen(true)}
                >
                  <LogOut className="size-4" />
                  Leave team
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Danger zone */}
        {isOwner ? (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-destructive">Danger zone</CardTitle>
              <CardDescription>
                Deleting the team permanently removes all of its projects, sections, boards and
                memberships. Members are notified. This cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-end">
              <Button variant="outline" className="gap-2 text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="size-4" />
                Delete team
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Remove member confirm */}
      <Dialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
            <DialogDescription>
              This removes <span className="font-medium">{removeTarget?.user.name}</span> (
              {removeTarget?.user.email}) from the team. They&apos;ll be notified and lose access to
              every team board.
            </DialogDescription>
          </DialogHeader>
          <form action={removeMember} className="space-y-4">
            <input type="hidden" name="teamId" value={team.id} />
            <input type="hidden" name="memberUserId" value={removeTarget?.user.id ?? ""} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRemoveTarget(null)}>
                Cancel
              </Button>
              <SubmitButton
                variant="ghost"
                pendingLabel="Removing…"
                className="text-destructive hover:text-destructive"
              >
                Remove member
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Leave team confirm */}
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Leave team</DialogTitle>
            <DialogDescription>
              You&apos;ll lose access to <span className="font-medium">{team.name}</span> and all of
              its boards. The owner can invite you back later.
            </DialogDescription>
          </DialogHeader>
          <form action={leaveTeam} className="space-y-4">
            <input type="hidden" name="teamId" value={team.id} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLeaveOpen(false)}>
                Cancel
              </Button>
              <SubmitButton
                variant="ghost"
                pendingLabel="Leaving…"
                className="text-destructive hover:text-destructive"
              >
                Leave team
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete team confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete team</DialogTitle>
            <DialogDescription>
              This permanently deletes <span className="font-medium">{team.name}</span>, including
              every project, section, board and card in it. Members are notified. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <form action={deleteTeam} className="space-y-4">
            <input type="hidden" name="teamId" value={team.id} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
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
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
