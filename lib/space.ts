import { cache } from "react";

import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { getCurrentUserId } from "@/lib/auth-session";
import { db } from "@/lib/db";
import type { MutationSpace } from "@/lib/db/mutations";
import { teamMembers } from "@/lib/db/schema";

// Resolve the space a request operates in: the signed-in user's personal
// space (no teamId) or a team they belong to, with their role. A teamId the
// user isn't a member of 404s — same posture as guessing a foreign project id.
// Cached per request so a layout, page and several data reads share one
// membership lookup.
export const getSpaceContext = cache(
  async (teamId?: string | null): Promise<MutationSpace> => {
    const uid = await getCurrentUserId();
    if (!teamId) {
      // Inlined personal space (not mutations' personalSpace helper) so this
      // module only type-imports from lib/db/mutations — keeps the module
      // graph acyclic (mutations → data → space).
      return { uid, teamId: null, role: null };
    }

    const membership = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, uid)),
      columns: { role: true },
    });
    if (!membership) {
      notFound();
    }

    return { uid, teamId, role: membership.role as "owner" | "member" };
  },
);
