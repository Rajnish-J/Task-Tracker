import { and, eq, inArray, or } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  ALL_PROJECTS_SCOPE,
  type Action,
  type Resource,
  teamMemberPermissions,
} from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// ABAC-style team member permissions. A row's presence means granted; there is
// no boolean flag. Grant = insert, revoke = delete. Keeps mutations.ts free of
// next/cache and next/navigation imports (same constraint as that module).
//
// Grants are also scoped by `projectId`: ALL_PROJECTS_SCOPE ("*") means "every
// project" (the original team-wide behavior), any other value scopes the
// grant to that one project. A member is permitted for a given project if
// either a "*" row or a project-specific row exists for that (resource, action).
// ---------------------------------------------------------------------------

export async function hasPermission(
  teamId: string,
  userId: string,
  resource: Resource,
  action: Action,
  projectId?: string,
): Promise<boolean> {
  const scopes = projectId ? [ALL_PROJECTS_SCOPE, projectId] : [ALL_PROJECTS_SCOPE];
  const row = await db.query.teamMemberPermissions.findFirst({
    where: and(
      eq(teamMemberPermissions.teamId, teamId),
      eq(teamMemberPermissions.userId, userId),
      eq(teamMemberPermissions.resource, resource),
      eq(teamMemberPermissions.action, action),
      inArray(teamMemberPermissions.projectId, scopes),
    ),
    columns: { id: true },
  });
  return Boolean(row);
}

// Full grant grid for every member of a team, for rendering the Management tab.
// Keyed by userId, then by project scope ("*" or a projectId).
export async function getTeamPermissionGrid(
  teamId: string,
): Promise<Map<string, Map<string, Set<`${Resource}:${Action}`>>>> {
  const rows = await db.query.teamMemberPermissions.findMany({
    where: eq(teamMemberPermissions.teamId, teamId),
    columns: { userId: true, resource: true, action: true, projectId: true },
  });
  const grid = new Map<string, Map<string, Set<`${Resource}:${Action}`>>>();
  for (const row of rows) {
    const key = `${row.resource}:${row.action}` as `${Resource}:${Action}`;
    const byProject = grid.get(row.userId) ?? new Map<string, Set<`${Resource}:${Action}`>>();
    const set = byProject.get(row.projectId) ?? new Set<`${Resource}:${Action}`>();
    set.add(key);
    byProject.set(row.projectId, set);
    grid.set(row.userId, byProject);
  }
  return grid;
}

// Bulk grant: N userIds x M (resource,action) pairs, scoped to a single
// project (or ALL_PROJECTS_SCOPE by default). Safe to call repeatedly — the
// unique (teamId,userId,resource,action,projectId) constraint makes this
// idempotent.
export async function grantPermissions(
  teamId: string,
  userIds: string[],
  pairs: { resource: Resource; action: Action }[],
  projectId: string = ALL_PROJECTS_SCOPE,
): Promise<void> {
  if (userIds.length === 0 || pairs.length === 0) return;
  const values = userIds.flatMap((userId) =>
    pairs.map((pair) => ({ teamId, userId, resource: pair.resource, action: pair.action, projectId })),
  );
  await db.insert(teamMemberPermissions).values(values).onConflictDoNothing();
}

// Bulk revoke: deletes only rows matching one of the given (resource,action)
// pairs and the given project scope, scoped to teamId + the given userIds —
// never touches other grants.
export async function revokePermissions(
  teamId: string,
  userIds: string[],
  pairs: { resource: Resource; action: Action }[],
  projectId: string = ALL_PROJECTS_SCOPE,
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
        eq(teamMemberPermissions.projectId, projectId),
        or(...pairConditions),
      ),
    );
}
