"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { and, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";

import { getCurrentUser, getCurrentUserId } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { MutationError } from "@/lib/db/mutations";
import { teamInvitations, teamMembers, user } from "@/lib/db/schema";
import { getNotifications, getPendingInvitationStatuses } from "@/lib/team-data";
import {
  cancelInvitationCore,
  createTeamCore,
  deleteTeamCore,
  inviteMemberCore,
  leaveTeamCore,
  markAllNotificationsReadCore,
  markNotificationReadCore,
  removeMemberCore,
  respondToInvitationCore,
  updateTeamCore,
} from "@/lib/db/team-mutations";

// Thin "use server" wrappers over lib/db/team-mutations.ts, mirroring
// app/actions.ts: resolve the user, run the core, translate not_found → 404,
// then revalidate/redirect.
async function run<T>(operation: Promise<T>): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    if (error instanceof MutationError && error.code === "not_found") {
      notFound();
    }
    throw error;
  }
}

export async function createTeam(formData: FormData) {
  const actor = await getCurrentUser();
  const team = await run(
    createTeamCore(
      {
        name: formData.get("name") as string,
        description: (formData.get("description") as string) || undefined,
        color: (formData.get("color") as string) || undefined,
        icon: (formData.get("icon") as string) || undefined,
        inviteeIds: formData.getAll("inviteeIds").map(String).filter(Boolean),
      },
      actor,
    ),
  );

  revalidatePath("/teams");
  redirect(`/teams/${team.id}`);
}

export async function updateTeam(formData: FormData) {
  const teamId = z.string().min(1).parse(formData.get("teamId"));
  const uid = await getCurrentUserId();
  await run(
    updateTeamCore(
      {
        teamId,
        name: formData.get("name") as string,
        description: (formData.get("description") as string) || undefined,
        color: (formData.get("color") as string) || undefined,
        icon: (formData.get("icon") as string) || undefined,
      },
      uid,
    ),
  );

  revalidatePath(`/teams/${teamId}`);
  revalidatePath(`/teams/${teamId}/settings`);
}

export async function deleteTeam(formData: FormData) {
  const teamId = z.string().min(1).parse(formData.get("teamId"));
  const actor = await getCurrentUser();
  await run(deleteTeamCore(teamId, actor));

  revalidatePath("/");
  redirect("/teams");
}

export async function inviteMember(input: { teamId: string; inviteeId: string }) {
  const values = z
    .object({ teamId: z.string().min(1), inviteeId: z.string().min(1) })
    .parse(input);
  const actor = await getCurrentUser();
  await run(inviteMemberCore(values, actor));

  revalidatePath(`/teams/${values.teamId}/settings`);
}

export async function cancelInvitation(formData: FormData) {
  const invitationId = z.string().min(1).parse(formData.get("invitationId"));
  const teamId = z.string().min(1).parse(formData.get("teamId"));
  const uid = await getCurrentUserId();
  await run(cancelInvitationCore(invitationId, uid));

  revalidatePath(`/teams/${teamId}/settings`);
}

export async function respondToInvitation(input: { invitationId: string; accept: boolean }) {
  const values = z
    .object({ invitationId: z.string().min(1), accept: z.boolean() })
    .parse(input);
  const actor = await getCurrentUser();
  const result = await run(respondToInvitationCore(values, actor));

  revalidatePath("/");
  revalidatePath("/settings");
  return result;
}

export async function removeMember(formData: FormData) {
  const values = z
    .object({ teamId: z.string().min(1), memberUserId: z.string().min(1) })
    .parse({
      teamId: formData.get("teamId"),
      memberUserId: formData.get("memberUserId"),
    });
  const actor = await getCurrentUser();
  await run(removeMemberCore(values, actor));

  revalidatePath(`/teams/${values.teamId}/settings`);
}

export async function leaveTeam(formData: FormData) {
  const teamId = z.string().min(1).parse(formData.get("teamId"));
  const uid = await getCurrentUserId();
  await run(leaveTeamCore(teamId, uid));

  revalidatePath("/");
  redirect("/");
}

export async function markNotificationRead(input: { notificationId: string }) {
  const { notificationId } = z
    .object({ notificationId: z.string().min(1) })
    .parse(input);
  const uid = await getCurrentUserId();
  await markNotificationReadCore(notificationId, uid);

  revalidatePath("/");
}

export async function markAllNotificationsRead() {
  const uid = await getCurrentUserId();
  await markAllNotificationsReadCore(uid);

  revalidatePath("/");
}

// Client-callable read for the notification bell: the sheet fetches on open
// instead of every page load carrying the full list. Invitation statuses ride
// along so Accept/Decline only render while an invite is still pending.
export async function getNotificationsAction() {
  const rows = await getNotifications();
  const invitationIds = rows
    .map((row) => (row.payload as { invitationId?: string }).invitationId)
    .filter((id): id is string => Boolean(id));
  const statuses = await getPendingInvitationStatuses(invitationIds);
  return {
    notifications: rows,
    invitationStatuses: Object.fromEntries(statuses),
  };
}

// ---------------------------------------------------------------------------
// User search for the invite flow. Prefix-matches on email (the requested UX:
// typing "r" lists r-starting addresses). Auth-gated; excludes the caller and,
// when a team is given, its members and pending invitees. Intentionally
// exposes registered emails to signed-in users — accepted product decision.
// ---------------------------------------------------------------------------

export type UserSearchResult = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

export async function searchUsersByEmail(
  query: string,
  excludeTeamId?: string,
): Promise<UserSearchResult[]> {
  const uid = await getCurrentUserId();
  const term = query.trim().toLowerCase();
  if (!term) return [];

  // Escape LIKE wildcards so "100%" searches literally.
  const escaped = term.replace(/[\\%_]/g, (ch) => `\\${ch}`);

  const excludedIds = new Set<string>([uid]);
  if (excludeTeamId) {
    const [members, pending] = await Promise.all([
      db.query.teamMembers.findMany({
        where: eq(teamMembers.teamId, excludeTeamId),
        columns: { userId: true },
      }),
      db.query.teamInvitations.findMany({
        where: and(
          eq(teamInvitations.teamId, excludeTeamId),
          eq(teamInvitations.status, "pending"),
        ),
        columns: { inviteeId: true },
      }),
    ]);
    for (const member of members) excludedIds.add(member.userId);
    for (const invite of pending) excludedIds.add(invite.inviteeId);
  }

  const rows = await db.query.user.findMany({
    where: or(ilike(user.name, `%${escaped}%`), ilike(user.email, `%${escaped}%`)),
    columns: { id: true, name: true, email: true, image: true },
    orderBy: (user, { asc }) => [asc(user.email)],
    limit: 8 + excludedIds.size,
  });

  return rows.filter((row) => !excludedIds.has(row.id)).slice(0, 8);
}
