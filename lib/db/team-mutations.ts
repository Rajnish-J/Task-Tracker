import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import {
  TEAM_COLOR_OPTIONS,
  TEAM_CREATION_LIMIT,
  TEAM_ICON_OPTIONS,
  TEAM_LIMIT_EXEMPT_EMAILS,
} from "@/lib/constants";
import { db } from "@/lib/db";
import { MutationError } from "@/lib/db/mutations";
import {
  type NotificationPayload,
  type NotificationType,
  notifications,
  teamInvitations,
  teamMembers,
  teams,
  user,
} from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Team mutation core. Same contract as lib/db/mutations.ts: no next/cache or
// next/navigation imports, failures surface as MutationError, and every
// function re-asserts the caller's team role itself — server actions are thin
// wrappers, never the security boundary.
// ---------------------------------------------------------------------------

export const createTeamSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  inviteeIds: z.array(z.string().min(1)).max(50).optional(),
});

export const updateTeamSchema = z.object({
  teamId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

type Actor = { id: string; email: string; name: string };

function normalizeColor(color?: string) {
  return (TEAM_COLOR_OPTIONS as readonly string[]).includes(color ?? "")
    ? (color as string)
    : null;
}

// Unlike color, an icon should always render something, so an invalid/missing
// value falls back to the default icon rather than null.
function normalizeIcon(icon?: string) {
  return (TEAM_ICON_OPTIONS as readonly string[]).includes(icon ?? "")
    ? (icon as string)
    : TEAM_ICON_OPTIONS[0];
}

// Membership row for (teamId, uid), or a 404-shaped MutationError — a
// non-member probing a team id learns nothing beyond "not found".
async function getMembership(teamId: string, uid: string) {
  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, uid)),
    columns: { id: true, role: true },
  });
  if (!membership) throw new MutationError(`Team ${teamId} not found`);
  return membership;
}

async function assertTeamOwner(teamId: string, uid: string) {
  const membership = await getMembership(teamId, uid);
  if (membership.role !== "owner") {
    throw new MutationError("Only the team owner can do this.", "forbidden");
  }
}

// Insert helper used inside transactions so a mutation and the notifications
// it produces commit together.
type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

async function notify(
  tx: DbOrTx,
  userIds: string[],
  type: NotificationType,
  payload: NotificationPayload,
) {
  if (userIds.length === 0) return;
  await tx
    .insert(notifications)
    .values(userIds.map((userId) => ({ userId, type, payload })));
}

export function isExemptFromTeamLimit(email: string) {
  return TEAM_LIMIT_EXEMPT_EMAILS.includes(email.toLowerCase());
}

export async function createTeamCore(
  input: z.input<typeof createTeamSchema>,
  actor: Actor,
) {
  const values = createTeamSchema.parse(input);

  if (!isExemptFromTeamLimit(actor.email)) {
    const [{ value: created }] = await db
      .select({ value: count() })
      .from(teams)
      .where(eq(teams.creatorId, actor.id));
    if (created >= TEAM_CREATION_LIMIT) {
      throw new MutationError(
        `You can create at most ${TEAM_CREATION_LIMIT} teams. Delete a team to free a slot.`,
        "invalid",
      );
    }
  }

  // Validate invitees up front: real users, minus the creator.
  const inviteeIds = [...new Set(values.inviteeIds ?? [])].filter((id) => id !== actor.id);
  const invitees = inviteeIds.length
    ? await db.query.user.findMany({
        where: inArray(user.id, inviteeIds),
        columns: { id: true },
      })
    : [];

  const team = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(teams)
      .values({
        name: values.name,
        description: values.description || null,
        color: normalizeColor(values.color),
        icon: normalizeIcon(values.icon),
        creatorId: actor.id,
      })
      .returning({ id: teams.id, name: teams.name });

    await tx.insert(teamMembers).values({
      teamId: created.id,
      userId: actor.id,
      role: "owner",
    });

    for (const invitee of invitees) {
      const [invitation] = await tx
        .insert(teamInvitations)
        .values({ teamId: created.id, inviterId: actor.id, inviteeId: invitee.id })
        .returning({ id: teamInvitations.id });
      await notify(tx, [invitee.id], "team_invite", {
        teamId: created.id,
        teamName: created.name,
        invitationId: invitation.id,
        actorId: actor.id,
        actorName: actor.name,
        actorEmail: actor.email,
      });
    }

    return created;
  });

  return { id: team.id };
}

export async function updateTeamCore(input: z.input<typeof updateTeamSchema>, uid: string) {
  const values = updateTeamSchema.parse(input);
  await assertTeamOwner(values.teamId, uid);

  await db
    .update(teams)
    .set({
      name: values.name,
      description: values.description || null,
      color: normalizeColor(values.color),
      icon: normalizeIcon(values.icon),
    })
    .where(eq(teams.id, values.teamId));

  return { id: values.teamId };
}

// Deleting a team cascades its memberships, invitations, projects, sections,
// tags and (transitively) boards. Remaining members are notified first, inside
// the same transaction, so the notice and the deletion commit together.
export async function deleteTeamCore(teamId: string, actor: Actor) {
  await assertTeamOwner(teamId, actor.id);

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    columns: { name: true },
    with: { members: { columns: { userId: true } } },
  });
  if (!team) throw new MutationError(`Team ${teamId} not found`);

  const memberIds = team.members.map((m) => m.userId).filter((id) => id !== actor.id);

  await db.transaction(async (tx) => {
    await notify(tx, memberIds, "team_deleted", {
      teamId,
      teamName: team.name,
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
    });
    await tx.delete(teams).where(eq(teams.id, teamId));
  });
}

export async function inviteMemberCore(
  input: { teamId: string; inviteeId: string },
  actor: Actor,
) {
  await assertTeamOwner(input.teamId, actor.id);

  if (input.inviteeId === actor.id) {
    throw new MutationError("You are already in this team.", "invalid");
  }

  const [team, invitee, existingMember, pendingInvite] = await Promise.all([
    db.query.teams.findFirst({ where: eq(teams.id, input.teamId), columns: { name: true } }),
    db.query.user.findFirst({ where: eq(user.id, input.inviteeId), columns: { id: true } }),
    db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, input.teamId), eq(teamMembers.userId, input.inviteeId)),
      columns: { id: true },
    }),
    db.query.teamInvitations.findFirst({
      where: and(
        eq(teamInvitations.teamId, input.teamId),
        eq(teamInvitations.inviteeId, input.inviteeId),
        eq(teamInvitations.status, "pending"),
      ),
      columns: { id: true },
    }),
  ]);

  if (!team) throw new MutationError(`Team ${input.teamId} not found`);
  if (!invitee) throw new MutationError("User not found");
  if (existingMember) throw new MutationError("Already a member of this team.", "invalid");
  if (pendingInvite) throw new MutationError("An invitation is already pending.", "invalid");

  try {
    await db.transaction(async (tx) => {
      const [invitation] = await tx
        .insert(teamInvitations)
        .values({ teamId: input.teamId, inviterId: actor.id, inviteeId: input.inviteeId })
        .returning({ id: teamInvitations.id });
      await notify(tx, [input.inviteeId], "team_invite", {
        teamId: input.teamId,
        teamName: team.name,
        invitationId: invitation.id,
        actorId: actor.id,
        actorName: actor.name,
        actorEmail: actor.email,
      });
    });
  } catch (error) {
    // Lost a race on the partial unique (one pending invite per team+invitee).
    if (/duplicate|unique/i.test(String(error))) {
      throw new MutationError("An invitation is already pending.", "invalid");
    }
    throw error;
  }
}

export async function cancelInvitationCore(invitationId: string, uid: string) {
  const invitation = await db.query.teamInvitations.findFirst({
    where: eq(teamInvitations.id, invitationId),
    columns: { id: true, teamId: true, status: true },
  });
  if (!invitation) throw new MutationError("Invitation not found");
  await assertTeamOwner(invitation.teamId, uid);
  if (invitation.status !== "pending") {
    throw new MutationError("Invitation was already resolved.", "invalid");
  }

  await db
    .update(teamInvitations)
    .set({ status: "canceled", respondedAt: new Date() })
    .where(and(eq(teamInvitations.id, invitationId), eq(teamInvitations.status, "pending")));
}

// Invitee accepts or declines. Either way the inviter is notified; on accept
// the invitee becomes a member. The invitee's own team_invite notification is
// marked read so the bell badge clears.
export async function respondToInvitationCore(
  input: { invitationId: string; accept: boolean },
  actor: Actor,
) {
  const invitation = await db.query.teamInvitations.findFirst({
    where: eq(teamInvitations.id, input.invitationId),
    with: { team: { columns: { id: true, name: true } } },
  });
  if (!invitation || invitation.inviteeId !== actor.id) {
    throw new MutationError("Invitation not found");
  }
  if (invitation.status !== "pending") {
    throw new MutationError("Invitation was already resolved.", "invalid");
  }
  // The team row is gone only if the team was deleted between invite and response.
  if (!invitation.team) {
    throw new MutationError("This team no longer exists.", "invalid");
  }

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(teamInvitations)
      .set({
        status: input.accept ? "accepted" : "declined",
        respondedAt: new Date(),
      })
      .where(
        and(eq(teamInvitations.id, input.invitationId), eq(teamInvitations.status, "pending")),
      )
      .returning({ id: teamInvitations.id });
    if (updated.length === 0) {
      throw new MutationError("Invitation was already resolved.", "invalid");
    }

    if (input.accept) {
      await tx
        .insert(teamMembers)
        .values({ teamId: invitation.teamId, userId: actor.id, role: "member" })
        .onConflictDoNothing();
    }

    await notify(tx, [invitation.inviterId], input.accept ? "invite_accepted" : "invite_declined", {
      teamId: invitation.teamId,
      teamName: invitation.team!.name,
      invitationId: invitation.id,
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
    });
  });

  return { teamId: invitation.teamId, accepted: input.accept };
}

export async function removeMemberCore(
  input: { teamId: string; memberUserId: string },
  actor: Actor,
) {
  await assertTeamOwner(input.teamId, actor.id);
  if (input.memberUserId === actor.id) {
    throw new MutationError("The owner cannot remove themselves — delete the team instead.", "invalid");
  }

  const team = await db.query.teams.findFirst({
    where: eq(teams.id, input.teamId),
    columns: { name: true },
  });

  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(teamMembers)
      .where(
        and(eq(teamMembers.teamId, input.teamId), eq(teamMembers.userId, input.memberUserId)),
      )
      .returning({ id: teamMembers.id });
    if (deleted.length === 0) {
      throw new MutationError("Member not found");
    }
    await notify(tx, [input.memberUserId], "member_removed", {
      teamId: input.teamId,
      teamName: team?.name,
      actorId: actor.id,
      actorName: actor.name,
      actorEmail: actor.email,
    });
  });
}

export async function leaveTeamCore(teamId: string, uid: string) {
  const membership = await getMembership(teamId, uid);
  if (membership.role === "owner") {
    throw new MutationError(
      "The owner cannot leave the team — delete it instead.",
      "invalid",
    );
  }

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, uid)));
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function markNotificationReadCore(notificationId: string, uid: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, uid)));
}

export async function markAllNotificationsReadCore(uid: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, uid), isNull(notifications.readAt)));
}
