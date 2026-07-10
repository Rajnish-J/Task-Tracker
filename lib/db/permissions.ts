import { and, eq, inArray, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { type Action, type Resource, teamMemberPermissions } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// ABAC-style team member permissions. A row's presence means granted; there is
// no boolean flag. Grant = insert, revoke = delete. Keeps mutations.ts free of
// next/cache and next/navigation imports (same constraint as that module).
// ---------------------------------------------------------------------------

export async function hasPermission(
  teamId: string,
  userId: string,
  resource: Resource,
  action: Action,
): Promise<boolean> {
  const row = await db.query.teamMemberPermissions.findFirst({
    where: and(
      eq(teamMemberPermissions.teamId, teamId),
      eq(teamMemberPermissions.userId, userId),
      eq(teamMemberPermissions.resource, resource),
      eq(teamMemberPermissions.action, action),
    ),
    columns: { id: true },
  });
  return Boolean(row);
}

// Full grant grid for every member of a team, for rendering the Management tab.
export async function getTeamPermissionGrid(
  teamId: string,
): Promise<Map<string, Set<`${Resource}:${Action}`>>> {
  const rows = await db.query.teamMemberPermissions.findMany({
    where: eq(teamMemberPermissions.teamId, teamId),
    columns: { userId: true, resource: true, action: true },
  });
  const grid = new Map<string, Set<`${Resource}:${Action}`>>();
  for (const row of rows) {
    const key = `${row.resource}:${row.action}` as `${Resource}:${Action}`;
    const set = grid.get(row.userId) ?? new Set<`${Resource}:${Action}`>();
    set.add(key);
    grid.set(row.userId, set);
  }
  return grid;
}

// Bulk grant: N userIds x M (resource,action) pairs. Safe to call repeatedly —
// the unique (teamId,userId,resource,action) constraint makes this idempotent.
export async function grantPermissions(
  teamId: string,
  userIds: string[],
  pairs: { resource: Resource; action: Action }[],
): Promise<void> {
  if (userIds.length === 0 || pairs.length === 0) return;
  const values = userIds.flatMap((userId) =>
    pairs.map((pair) => ({ teamId, userId, resource: pair.resource, action: pair.action })),
  );
  await db.insert(teamMemberPermissions).values(values).onConflictDoNothing();
}

// Bulk revoke: deletes only rows matching one of the given (resource,action)
// pairs, scoped to teamId + the given userIds — never touches other grants.
export async function revokePermissions(
  teamId: string,
  userIds: string[],
  pairs: { resource: Resource; action: Action }[],
): Promise<void> {
  if (userIds.length === 0 || pairs.length === 0) return;
  const pairConditions = pairs.map((pair) =>
    and(eq(teamMemberPermissions.resource, pair.resource), eq(teamMemberPermissions.action, pair.action)),
  );
  await db
    .delete(teamMemberPermissions)
    .where(
      and(
        eq(teamMemberPermissions.teamId, teamId),
        inArray(teamMemberPermissions.userId, userIds),
        or(...pairConditions),
      ),
    );
}
