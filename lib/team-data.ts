import { and, count, desc, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";

import { getCurrentUser, getCurrentUserId } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { getTeamPermissionGrid } from "@/lib/db/permissions";
import { isExemptFromTeamLimit } from "@/lib/db/team-mutations";
import { TEAM_CREATION_LIMIT } from "@/lib/constants";
import { notifications, teamMembers, teams } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Team reads. Same posture as lib/data.ts: every function resolves the
// signed-in user itself and scopes queries to their memberships; a foreign
// team id 404s.
// ---------------------------------------------------------------------------

export type UserTeam = {
  id: string;
  name: string;
  color: string | null;
  role: "owner" | "member";
};

// Teams the user belongs to, for the sidebar space switcher.
export async function getUserTeams(): Promise<UserTeam[]> {
  const uid = await getCurrentUserId();
  const rows = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, uid),
    columns: { role: true },
    with: { team: { columns: { id: true, name: true, color: true } } },
  });
  return rows
    .filter((row) => row.team)
    .map((row) => ({
      id: row.team.id,
      name: row.team.name,
      color: row.team.color,
      role: row.role as "owner" | "member",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Teams overview for /teams, plus whether the user may create another team.
export async function getTeamsOverview() {
  const user = await getCurrentUser();
  const [memberships, [{ value: createdCount }]] = await Promise.all([
    db.query.teamMembers.findMany({
      where: eq(teamMembers.userId, user.id),
      columns: { role: true },
      with: {
        team: {
          columns: { id: true, name: true, description: true, color: true, createdAt: true },
          with: { members: { columns: { id: true } } },
        },
      },
    }),
    db.select({ value: count() }).from(teams).where(eq(teams.creatorId, user.id)),
  ]);

  const list = memberships
    .filter((row) => row.team)
    .map((row) => ({
      id: row.team.id,
      name: row.team.name,
      description: row.team.description,
      color: row.team.color,
      createdAt: row.team.createdAt,
      role: row.role as "owner" | "member",
      memberCount: row.team.members.length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    teams: list,
    canCreateTeam: isExemptFromTeamLimit(user.email) || createdCount < TEAM_CREATION_LIMIT,
  };
}

// Full team detail for the team settings page. Membership-guarded; pending
// invitations are included only for the owner (members see the roster only).
export async function getTeam(teamId: string) {
  const uid = await getCurrentUserId();
  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, uid)),
    columns: { role: true },
  });
  if (!membership) notFound();
  const role = membership.role as "owner" | "member";

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    columns: { id: true, name: true, description: true, color: true, createdAt: true },
    with: {
      members: {
        columns: { id: true, role: true, createdAt: true },
        with: { user: { columns: { id: true, name: true, email: true, image: true } } },
      },
      invitations: {
        columns: { id: true, status: true, createdAt: true },
        with: { invitee: { columns: { id: true, name: true, email: true, image: true } } },
      },
    },
  });
  if (!team) notFound();

  // Only the owner edits permissions, so the grid is only fetched for them —
  // same role-gating pattern as pendingInvitations below. Serialized as plain
  // arrays (Map/Set don't cross the RSC boundary into the client component).
  const memberPermissions =
    role === "owner"
      ? Object.fromEntries(
          [...(await getTeamPermissionGrid(teamId)).entries()].map(([userId, set]) => [
            userId,
            [...set],
          ]),
        )
      : {};

  return {
    id: team.id,
    name: team.name,
    description: team.description,
    color: team.color,
    createdAt: team.createdAt,
    role,
    currentUserId: uid,
    memberPermissions,
    members: team.members
      .map((member) => ({
        id: member.id,
        role: member.role as "owner" | "member",
        joinedAt: member.createdAt,
        user: member.user,
      }))
      .sort((a, b) => (a.role === b.role ? a.user.name.localeCompare(b.user.name) : a.role === "owner" ? -1 : 1)),
    pendingInvitations:
      role === "owner"
        ? team.invitations
            .filter((invitation) => invitation.status === "pending")
            .map((invitation) => ({
              id: invitation.id,
              createdAt: invitation.createdAt,
              invitee: invitation.invitee,
            }))
        : [],
  };
}

export type TeamDetail = Awaited<ReturnType<typeof getTeam>>;

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function getNotifications(limit = 30) {
  const uid = await getCurrentUserId();
  return db.query.notifications.findMany({
    where: eq(notifications.userId, uid),
    orderBy: [desc(notifications.createdAt)],
    limit,
  });
}

export type NotificationRow = Awaited<ReturnType<typeof getNotifications>>[number];

export async function getUnreadNotificationCount(): Promise<number> {
  const uid = await getCurrentUserId();
  const [{ value }] = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, uid), isNull(notifications.readAt)));
  return value;
}

// Pending invitations addressed to the current user, with live status of the
// underlying invitation so Accept/Decline buttons only render while actionable.
export async function getPendingInvitationStatuses(invitationIds: string[]) {
  if (invitationIds.length === 0) return new Map<string, string>();
  const uid = await getCurrentUserId();
  const rows = await db.query.teamInvitations.findMany({
    where: (teamInvitations, { and, eq, inArray }) =>
      and(inArray(teamInvitations.id, invitationIds), eq(teamInvitations.inviteeId, uid)),
    columns: { id: true, status: true },
  });
  return new Map(rows.map((row) => [row.id, row.status]));
}
