"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { MutationError } from "@/lib/db/mutations";
import { grantPermissions, revokePermissions } from "@/lib/db/permissions";
import { ACTION_VALUES, ALL_PROJECTS_SCOPE, RESOURCE_VALUES } from "@/lib/db/schema";
import { getSpaceContext } from "@/lib/space";

// Grant/revoke actions for the team settings Management tab. Both single- and
// multi-member toggles, and both the default (team-wide) grid and per-project
// overrides, funnel through these same two actions.
const pairSchema = z.object({
  resource: z.enum(RESOURCE_VALUES),
  action: z.enum(ACTION_VALUES),
});

const inputSchema = z.object({
  teamId: z.string().min(1),
  userIds: z.array(z.string().min(1)).min(1),
  pairs: z.array(pairSchema).min(1),
  // Omitted/undefined ⇒ the default ("*") scope, applying to every project.
  projectId: z.string().min(1).optional(),
});

async function assertOwner(teamId: string) {
  const space = await getSpaceContext(teamId);
  if (space.role !== "owner") {
    throw new MutationError("Only the team owner can manage member permissions.", "forbidden");
  }
}

export async function grantMemberPermissions(input: z.input<typeof inputSchema>) {
  const values = inputSchema.parse(input);
  await assertOwner(values.teamId);
  await grantPermissions(
    values.teamId,
    values.userIds,
    values.pairs,
    values.projectId ?? ALL_PROJECTS_SCOPE,
  );
  revalidatePath(`/teams/${values.teamId}/settings`);
}

export async function revokeMemberPermissions(input: z.input<typeof inputSchema>) {
  const values = inputSchema.parse(input);
  await assertOwner(values.teamId);
  await revokePermissions(
    values.teamId,
    values.userIds,
    values.pairs,
    values.projectId ?? ALL_PROJECTS_SCOPE,
  );
  revalidatePath(`/teams/${values.teamId}/settings`);
}
