"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { LogOut, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { deleteTag } from "@/app/actions";
import {
  cancelInvitation,
  deleteTeam,
  inviteMember,
  leaveTeam,
  removeMember,
  updateTeam,
} from "@/app/team-actions";
import { ActionForm } from "@/components/action-form";
import { AccentSelect } from "@/components/accent-select";
import { IconSelect } from "@/components/icon-select";
import { MemberSearch } from "@/components/member-search";
import { SubmitButton } from "@/components/submit-button";
import { TagBadge } from "@/components/tag-badge";
import { TeamManagementView } from "@/components/team-management-view";
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
import { HeaderBreadcrumb } from "@/components/header-slots";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TEAM_COLOR_OPTIONS, TEAM_ICON_OPTIONS } from "@/lib/constants";
import type { TeamDetail } from "@/lib/team-data";
import { initials } from "@/lib/utils/initials";
import { useInterval } from "@/hooks/use-interval";

const POLL_INTERVAL_MS = 15000;

// Team management: details (owner-editable), members (invite / remove /
// leave), pending invitations, and the owner's danger zone.
export function TeamSettingsView({ team }: { team: TeamDetail }) {
  const router = useRouter();
  const isOwner = team.role === "owner";
  const [color, setColor] = React.useState<string>(team.color ?? TEAM_COLOR_OPTIONS[0]);
  const [icon, setIcon] = React.useState<string>(team.icon ?? TEAM_ICON_OPTIONS[0]);
  const [removeTarget, setRemoveTarget] = React.useState<TeamDetail["members"][number] | null>(null);
  const [leaveOpen, setLeaveOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [inviteError, setInviteError] = React.useState<string | null>(null);
  const [inviting, setInviting] = React.useState(false);

  // Poll so members/invitations added by someone else show up without a
  // manual reload; `team` cascades down into TeamManagementView too.
  useInterval(() => router.refresh(), POLL_INTERVAL_MS);

  const handleInvite = async (user: { id: string }) => {
    setInviting(true);
    setInviteError(null);
    try {
      await inviteMember({ teamId: team.id, inviteeId: user.id });
      toast.success("Invitation sent");
      router.refresh();
    } catch {
      setInviteError("Could not send the invitation. They may already be invited.");
      toast.error("Could not send the invitation.");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <HeaderBreadcrumb>
        <span>{team.name}</span>
        <span>/</span>
        <span className="text-foreground">Team settings</span>
      </HeaderBreadcrumb>
      <header className="shrink-0 border-b border-border/60 bg-background/80 px-4 py-4 backdrop-blur md:px-6">
        <div className="space-y-3">
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

      <div className="flex-1 overflow-y-auto">
      <Tabs defaultValue="general" className="w-full p-4 md:p-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          {isOwner ? <TabsTrigger value="management">Management</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="general">
      <div className="flex flex-col gap-6">
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
              <ActionForm
                action={updateTeam}
                successMessage="Team updated"
                errorMessage="Couldn't update team. Please try again."
                className="space-y-4"
              >
                <input type="hidden" name="teamId" value={team.id} />
                <input type="hidden" name="color" value={color} />
                <input type="hidden" name="icon" value={icon} />
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
                  <label className="text-sm font-medium">Icon</label>
                  <IconSelect value={icon} onValueChange={setIcon} placeholder="Team icon" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Accent</label>
                  <AccentSelect value={color} onValueChange={setColor} placeholder="Team accent" />
                </div>
                <div className="flex justify-end">
                  <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
                </div>
              </ActionForm>
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
                  placeholder={inviting ? "Sending invitation…" : "Search by name or email to invite…"}
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
                      <ActionForm
                        action={cancelInvitation}
                        successMessage="Invitation canceled"
                        errorMessage="Couldn't cancel invitation. Please try again."
                      >
                        <input type="hidden" name="invitationId" value={invitation.id} />
                        <input type="hidden" name="teamId" value={team.id} />
                        <SubmitButton variant="ghost" size="sm" pendingLabel="Canceling…">
                          Cancel
                        </SubmitButton>
                      </ActionForm>
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

        {/* Tags */}
        <Card>
          <CardHeader>
            <CardTitle>Tags</CardTitle>
            <CardDescription>
              Tags used across this team&apos;s projects and tasks. Deleting one removes it from
              anything it&apos;s applied to, without deleting those items.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {team.tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags yet.</p>
            ) : (
              <ul className="divide-y divide-border/60 rounded-md border border-border/60">
                {team.tags.map((tag) => (
                  <li key={tag.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <TagBadge tag={tag} />
                    <ActionForm
                      action={deleteTag}
                      successMessage={`Deleted "${tag.name}"`}
                      errorMessage="Couldn't delete tag. Please try again."
                    >
                      <input type="hidden" name="tagId" value={tag.id} />
                      <input type="hidden" name="teamId" value={team.id} />
                      <SubmitButton
                        variant="ghost"
                        size="sm"
                        pendingLabel="Deleting…"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            )}
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
        </TabsContent>

        {isOwner ? (
          <TabsContent value="management">
            <TeamManagementView team={team} />
          </TabsContent>
        ) : null}
      </Tabs>
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
          <ActionForm
            action={removeMember}
            successMessage="Member removed"
            errorMessage="Couldn't remove member. Please try again."
            onSuccess={() => setRemoveTarget(null)}
            className="space-y-4"
          >
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
          </ActionForm>
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
          <ActionForm
            action={leaveTeam}
            errorMessage="Couldn't leave team. Please try again."
            className="space-y-4"
          >
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
          </ActionForm>
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
          <ActionForm
            action={deleteTeam}
            errorMessage="Couldn't delete team. Please try again."
            className="space-y-4"
          >
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
          </ActionForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}
