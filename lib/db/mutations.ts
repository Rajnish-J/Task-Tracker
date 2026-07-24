import { and, asc, desc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { cache } from "react";
import { z } from "zod";

import { COLUMN_COLOR_OPTIONS, DEFAULT_COLUMNS, TAG_COLOR_OPTIONS } from "@/lib/constants";
import { statusKeyFromColumnName } from "@/lib/data";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/db/permissions";
import {
  type Action,
  columns,
  PRIORITY_VALUES,
  projects,
  type Resource,
  sections,
  storyTasks,
  tags,
  tasks,
} from "@/lib/db/schema";
import { slugify } from "@/lib/utils/slugify";

// ---------------------------------------------------------------------------
// Shared mutation core. Extracted from app/actions.ts so the same logic can be
// invoked from server actions (which wrap it with revalidatePath/redirect) and
// from the chat assistant's tool executor (a route handler where next/navigation
// throws like notFound()/redirect() are unsupported). This module therefore
// never imports next/cache or next/navigation — failures surface as
// MutationError and callers translate it for their surface.
// ---------------------------------------------------------------------------

export class MutationError extends Error {
  constructor(
    message: string,
    public readonly code: "not_found" | "invalid" | "forbidden" = "not_found",
  ) {
    super(message);
    this.name = "MutationError";
  }
}

// ---------------------------------------------------------------------------
// Mutation space. Every mutation runs either in the user's personal space or
// inside a team the user belongs to (with their role). Rows are personal
// (userId set, teamId NULL) or team-owned (teamId set, userId NULL) — the NULL
// userId on team rows keeps a member's account deletion from cascading into
// shared team data. Callers (server actions, chat tools) resolve the space;
// cores can't run without one, so no code path skips scoping.
// ---------------------------------------------------------------------------

export type MutationSpace =
  | { uid: string; teamId: null; role: null }
  | { uid: string; teamId: string; role: "owner" | "member" };

export function personalSpace(uid: string): MutationSpace {
  return { uid, teamId: null, role: null };
}

// Ownership columns for rows inserted in this space.
function spaceOwnership(space: MutationSpace) {
  return space.teamId
    ? { userId: null, teamId: space.teamId }
    : { userId: space.uid, teamId: null };
}

function projectScope(space: MutationSpace) {
  return space.teamId
    ? eq(projects.teamId, space.teamId)
    : and(eq(projects.userId, space.uid), isNull(projects.teamId));
}

function sectionScope(space: MutationSpace) {
  return space.teamId
    ? eq(sections.teamId, space.teamId)
    : and(eq(sections.userId, space.uid), isNull(sections.teamId));
}

function tagScope(space: MutationSpace) {
  return space.teamId
    ? eq(tags.teamId, space.teamId)
    : and(eq(tags.userId, space.uid), isNull(tags.teamId));
}

// Request-scoped memo so a core that happens to check the same tuple twice in
// one request doesn't issue duplicate queries (mirrors getSpaceContext's use
// of React's cache() in lib/space.ts).
const cachedHasPermission = cache(hasPermission);

// ABAC gate for project/section/column/task mutations. Personal space has no
// ABAC; team owners are always fully permitted; team members need an explicit
// grant (see lib/db/permissions.ts) for the given (resource, action) pair.
export async function assertSpacePermission(
  space: MutationSpace,
  resource: Resource,
  action: Action,
  projectId?: string,
) {
  if (!space.teamId) return;
  if (space.role === "owner") return;
  const granted = await cachedHasPermission(space.teamId, space.uid, resource, action, projectId);
  if (!granted) {
    throw new MutationError(`You don't have permission to ${action} ${resource}s in this team.`, "forbidden");
  }
}

// ---------------------------------------------------------------------------
// Authorization helpers. Every mutation asserts that the project/section/task
// it targets belongs to the given space before touching any row. Ownership
// roots at Project/Section (both carry userId/teamId); columns/tasks/storyTasks
// are authorized transitively through their project. A mismatch throws
// MutationError("not_found") — an attacker guessing another user's id gets a
// 404 (or an is_error tool result), never a mutation.
// ---------------------------------------------------------------------------

export async function assertProjectOwned(projectId: string, space: MutationSpace) {
  const owned = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), projectScope(space)),
    columns: { id: true },
  });
  if (!owned) throw new MutationError(`Project ${projectId} not found`);
}

export async function assertSectionOwned(sectionId: string, space: MutationSpace) {
  const owned = await db.query.sections.findFirst({
    where: and(eq(sections.id, sectionId), sectionScope(space)),
    columns: { id: true },
  });
  if (!owned) throw new MutationError(`Section ${sectionId} not found`);
}

// Assumes the project was already asserted owned; confirms the column lives in it.
export async function assertColumnInProject(columnId: string, projectId: string) {
  const owned = await db.query.columns.findFirst({
    where: and(eq(columns.id, columnId), eq(columns.projectId, projectId)),
    columns: { id: true },
  });
  if (!owned) throw new MutationError(`Column ${columnId} not found in project ${projectId}`);
}

// Assumes the project was already asserted owned; confirms the task lives in it
// and returns it (with columnId) for callers that need to re-sequence positions.
export async function assertTaskInProject(taskId: string, projectId: string) {
  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)),
    columns: { id: true, columnId: true },
  });
  if (!task) throw new MutationError(`Task ${taskId} not found in project ${projectId}`);
  return task;
}

// Tag fields shared by every create/edit input. Callers provide either a chosen
// `tagId` or a new `tagName` (+ optional `tagColor`); both are optional.
const tagFields = {
  tagId: z.string().optional(),
  tagName: z.string().trim().max(40).optional(),
  tagColor: z.string().optional(),
};

// Resolve the single tag for an item: use the chosen id, else find-or-create by
// name (case-insensitive), else leave it untagged. Tag rows live independently
// of the item so this runs outside the item's transaction.
export async function resolveTagId(
  input: {
    tagId?: string;
    tagName?: string;
    tagColor?: string;
  },
  space: MutationSpace,
): Promise<string | null> {
  if (input.tagId) {
    // A chosen tag must belong to this space, else ignore it (never adopt
    // another space's tag onto an item).
    const owned = await db.query.tags.findFirst({
      where: and(eq(tags.id, input.tagId), tagScope(space)),
      columns: { id: true },
    });
    return owned?.id ?? null;
  }

  const name = input.tagName?.trim();
  if (!name) {
    return null;
  }

  const existing = await db.query.tags.findFirst({
    where: and(ilike(tags.name, name), tagScope(space)),
    columns: { id: true },
  });
  if (existing) {
    return existing.id;
  }

  const color = (TAG_COLOR_OPTIONS as readonly string[]).includes(input.tagColor ?? "")
    ? (input.tagColor as string)
    : TAG_COLOR_OPTIONS[0];

  try {
    const [created] = await db
      .insert(tags)
      .values({ name, color, ...spaceOwnership(space) })
      .returning({ id: tags.id });
    return created.id;
  } catch {
    // Lost a race on the (userId, name) / (teamId, name) unique — re-read the winner.
    const fallback = await db.query.tags.findFirst({
      where: and(ilike(tags.name, name), tagScope(space)),
      columns: { id: true },
    });
    return fallback?.id ?? null;
  }
}

// Deletes are un-gated by ABAC, same as create/resolve above — tags aren't a
// Resource in the permission system, so any space member can manage them.
// References elsewhere (tasks, projects, sections) are ON DELETE SET NULL, so
// this only detaches the tag; it never cascades into the tagged items.
export async function deleteTagCore(tagId: string, space: MutationSpace) {
  const deleted = await db
    .delete(tags)
    .where(and(eq(tags.id, tagId), tagScope(space)))
    .returning({ id: tags.id });
  if (deleted.length === 0) {
    throw new MutationError(`Tag ${tagId} not found`);
  }
}

// ---------------------------------------------------------------------------
// Input schemas. Single validation point for both server actions and chat
// tools — cores parse their own input.
// ---------------------------------------------------------------------------

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  sectionId: z.string().optional(),
  dueDate: z.string().optional(),
  ...tagFields,
});

export const updateProjectSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  sectionId: z.string().optional(),
  dueDate: z.string().optional(),
  ...tagFields,
});

export const createColumnSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(2).max(40),
  color: z.enum(COLUMN_COLOR_OPTIONS).optional(),
});

export const updateColumnSchema = z.object({
  projectId: z.string().min(1),
  columnId: z.string().min(1),
  name: z.string().trim().min(2).max(40),
  color: z.enum(COLUMN_COLOR_OPTIONS),
});

export const createTaskSchema = z.object({
  projectId: z.string().min(1),
  columnId: z.string().min(1),
  title: z.string().trim().min(2).max(120),
  shortDescription: z.string().trim().max(160).optional(),
  description: z.string().trim().max(600).optional(),
  notes: z.string().trim().max(1200).optional(),
  priority: z.enum(PRIORITY_VALUES),
  dueDate: z.string().optional(),
  ...tagFields,
});

export const updateTaskSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  title: z.string().trim().min(2).max(120),
  shortDescription: z.string().trim().max(160).optional(),
  description: z.string().trim().max(600).optional(),
  notes: z.string().trim().max(1200).optional(),
  priority: z.enum(PRIORITY_VALUES),
  columnId: z.string().min(1),
  dueDate: z.string().optional(),
  ...tagFields,
});

export const moveTaskSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  toColumnId: z.string().min(1),
  toIndex: z.number().int().min(0),
});

export const reorderProjectsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export const createSectionSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  parentId: z.string().optional(),
  ...tagFields,
});

export const updateSectionSchema = z.object({
  sectionId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  parentId: z.string().optional(),
  ...tagFields,
});

export const createStoryTaskSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(600).optional(),
  priority: z.enum(PRIORITY_VALUES),
  dueDate: z.string().optional(),
  ...tagFields,
});

export const updateStoryTaskSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  storyTaskId: z.string().min(1),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(600).optional(),
  priority: z.enum(PRIORITY_VALUES),
  dueDate: z.string().optional(),
  ...tagFields,
});

export const updateStoryTasksBatchSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  items: z.array(updateStoryTaskSchema.omit({ projectId: true, taskId: true })).min(1),
});

export const toggleStoryTaskSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  storyTaskId: z.string().min(1),
  isDone: z.boolean(),
});

// Large offset used to temporarily park positions out of the way so that
// reordering within a column never trips the (columnId, position) unique
// constraint mid-transaction.
const POSITION_OFFSET = 1_000_000;

export function parseOptionalDate(value?: string) {
  if (!value?.trim()) {
    return null;
  }

  return new Date(`${value}T00:00:00.000Z`);
}

async function slugExists(slug: string, table: "projects" | "sections", space: MutationSpace) {
  if (table === "sections") {
    return Boolean(
      await db.query.sections.findFirst({
        where: and(eq(sections.slug, slug), sectionScope(space)),
        columns: { id: true },
      }),
    );
  }
  return Boolean(
    await db.query.projects.findFirst({
      where: and(eq(projects.slug, slug), projectScope(space)),
      columns: { id: true },
    }),
  );
}

// Projects and sections own separate slug spaces, scoped per user or per team;
// pass the table and space so the uniqueness check (and fallback base) targets
// the right one within that space's data.
async function resolveUniqueSlug(name: string, table: "projects" | "sections", space: MutationSpace) {
  const baseSlug = slugify(name) || (table === "sections" ? "section" : "project");
  let slug = baseSlug;
  let suffix = 1;

  while (await slugExists(slug, table, space)) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  return slug;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function createProjectCore(
  input: z.input<typeof createProjectSchema>,
  space: MutationSpace,
) {
  await assertSpacePermission(space, "project", "create");
  const values = createProjectSchema.parse(input);
  if (values.sectionId) {
    await assertSectionOwned(values.sectionId, space);
  }

  const slug = await resolveUniqueSlug(values.name, "projects", space);
  const tagId = await resolveTagId(values, space);

  const project = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(projects)
      .values({
        name: values.name,
        slug,
        description: values.description || null,
        dueDate: parseOptionalDate(values.dueDate),
        tagId,
        sectionId: values.sectionId || null,
        ...spaceOwnership(space),
      })
      .returning({ id: projects.id });

    await tx.insert(columns).values(
      DEFAULT_COLUMNS.map((column, index) => ({
        projectId: created.id,
        name: column.name,
        color: column.color,
        position: index,
      })),
    );

    return created;
  });

  return { id: project.id, slug };
}

// Edit a project's full details (name, description, section, tag). Re-slugs
// only when the name changes, and resolves the tag the same find-or-create way
// as creation.
export async function updateProjectCore(
  input: z.input<typeof updateProjectSchema>,
  space: MutationSpace,
) {
  const values = updateProjectSchema.parse(input);
  await assertSpacePermission(space, "project", "update", values.projectId);
  await assertProjectOwned(values.projectId, space);
  if (values.sectionId) {
    await assertSectionOwned(values.sectionId, space);
  }

  const existing = await db.query.projects.findFirst({
    where: and(eq(projects.id, values.projectId), projectScope(space)),
    columns: { name: true },
  });
  if (!existing) {
    throw new MutationError(`Project ${values.projectId} not found`);
  }

  const slug =
    existing.name !== values.name
      ? await resolveUniqueSlug(values.name, "projects", space)
      : undefined;
  const tagId = await resolveTagId(values, space);

  await db
    .update(projects)
    .set({
      name: values.name,
      description: values.description || null,
      dueDate: parseOptionalDate(values.dueDate),
      sectionId: values.sectionId || null,
      tagId,
      ...(slug ? { slug } : {}),
    })
    .where(and(eq(projects.id, values.projectId), projectScope(space)));

  return { id: values.projectId };
}

// Delete a project and its entire board. Columns, tasks and story tasks are
// removed by the cascade FKs in the schema.
export async function deleteProjectCore(projectId: string, space: MutationSpace) {
  await assertSpacePermission(space, "project", "delete", projectId);
  await assertProjectOwned(projectId, space);
  await db.delete(projects).where(and(eq(projects.id, projectId), projectScope(space)));
}

// Move a project into a section (or ungroup it when sectionId is null).
export async function updateProjectSectionCore(
  input: { projectId: string; sectionId: string | null },
  space: MutationSpace,
) {
  await assertSpacePermission(space, "project", "update", input.projectId);
  await assertProjectOwned(input.projectId, space);
  if (input.sectionId) {
    await assertSectionOwned(input.sectionId, space);
  }

  await db
    .update(projects)
    .set({ sectionId: input.sectionId || null })
    .where(and(eq(projects.id, input.projectId), projectScope(space)));
}

export async function reorderProjectsCore(
  input: z.input<typeof reorderProjectsSchema>,
  space: MutationSpace,
) {
  await assertSpacePermission(space, "project", "update");
  const { orderedIds } = reorderProjectsSchema.parse(input);

  // Every id must be one of this space's projects, or the reorder is rejected
  // wholesale — no partial writes that could touch someone else's rows.
  const owned = await db.query.projects.findMany({
    where: and(inArray(projects.id, orderedIds), projectScope(space)),
    columns: { id: true },
  });
  if (owned.length !== orderedIds.length) {
    throw new MutationError("One or more projects not found");
  }

  await db.transaction(async (tx) => {
    // Phase 1: park every project at a high, still-unique position so the final
    // pass below can't collide while positions are being shuffled.
    for (const [index, id] of orderedIds.entries()) {
      await tx
        .update(projects)
        .set({ position: POSITION_OFFSET + index })
        .where(and(eq(projects.id, id), projectScope(space)));
    }

    // Phase 2: assign contiguous final positions matching the requested order.
    for (const [index, id] of orderedIds.entries()) {
      await tx
        .update(projects)
        .set({ position: index })
        .where(and(eq(projects.id, id), projectScope(space)));
    }
  });
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

export async function createColumnCore(
  input: z.input<typeof createColumnSchema>,
  space: MutationSpace,
) {
  const values = createColumnSchema.parse(input);
  await assertProjectOwned(values.projectId, space);
  await assertSpacePermission(space, "column", "create", values.projectId);

  const [lastColumn] = await db
    .select({ position: columns.position })
    .from(columns)
    .where(eq(columns.projectId, values.projectId))
    .orderBy(desc(columns.position))
    .limit(1);

  const [created] = await db
    .insert(columns)
    .values({
      projectId: values.projectId,
      name: values.name,
      color: values.color ?? COLUMN_COLOR_OPTIONS[0],
      position: (lastColumn?.position ?? -1) + 1,
    })
    .returning({ id: columns.id });

  return { id: created.id };
}

export async function updateColumnCore(
  input: z.input<typeof updateColumnSchema>,
  space: MutationSpace,
) {
  const values = updateColumnSchema.parse(input);
  await assertProjectOwned(values.projectId, space);
  await assertColumnInProject(values.columnId, values.projectId);
  await assertSpacePermission(space, "column", "update", values.projectId);

  await db
    .update(columns)
    .set({ name: values.name, color: values.color })
    .where(and(eq(columns.id, values.columnId), eq(columns.projectId, values.projectId)));
}

// Deletes a column, moving its tasks to a fallback lane and re-sequencing
// positions. Refuses (no-op) when it's the project's last column.
export async function deleteColumnCore(
  input: { projectId: string; columnId: string },
  space: MutationSpace,
) {
  await assertProjectOwned(input.projectId, space);
  await assertColumnInProject(input.columnId, input.projectId);
  await assertSpacePermission(space, "column", "delete", input.projectId);

  const projectColumns = await db
    .select({ id: columns.id, position: columns.position })
    .from(columns)
    .where(eq(columns.projectId, input.projectId))
    .orderBy(asc(columns.position));

  if (projectColumns.length <= 1) {
    throw new MutationError("Cannot delete the project's only column", "invalid");
  }

  const fallbackColumn = projectColumns.find((column) => column.id !== input.columnId);

  await db.transaction(async (tx) => {
    if (fallbackColumn) {
      const [lastTask] = await tx
        .select({ position: tasks.position })
        .from(tasks)
        .where(eq(tasks.columnId, fallbackColumn.id))
        .orderBy(desc(tasks.position))
        .limit(1);

      const tasksToMove = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.columnId, input.columnId))
        .orderBy(asc(tasks.position));

      let nextPosition = (lastTask?.position ?? -1) + 1;
      for (const task of tasksToMove) {
        await tx
          .update(tasks)
          .set({ columnId: fallbackColumn.id, position: nextPosition })
          .where(eq(tasks.id, task.id));
        nextPosition += 1;
      }
    }

    await tx.delete(columns).where(eq(columns.id, input.columnId));

    const remaining = await tx
      .select({ id: columns.id })
      .from(columns)
      .where(eq(columns.projectId, input.projectId))
      .orderBy(asc(columns.position));

    for (const [index, column] of remaining.entries()) {
      await tx
        .update(columns)
        .set({ position: index })
        .where(eq(columns.id, column.id));
    }
  });
}

// ---------------------------------------------------------------------------
// Tasks (board cards)
// ---------------------------------------------------------------------------

export async function createTaskCore(
  input: z.input<typeof createTaskSchema>,
  space: MutationSpace,
) {
  const values = createTaskSchema.parse(input);
  await assertProjectOwned(values.projectId, space);
  await assertColumnInProject(values.columnId, values.projectId);
  await assertSpacePermission(space, "task", "create", values.projectId);

  const tagId = await resolveTagId(values, space);

  const [lastTask] = await db
    .select({ position: tasks.position })
    .from(tasks)
    .where(eq(tasks.columnId, values.columnId))
    .orderBy(desc(tasks.position))
    .limit(1);

  const [created] = await db
    .insert(tasks)
    .values({
      title: values.title,
      shortDescription: values.shortDescription || null,
      description: values.description || null,
      notes: values.notes || null,
      priority: values.priority,
      dueDate: parseOptionalDate(values.dueDate),
      projectId: values.projectId,
      columnId: values.columnId,
      tagId,
      position: (lastTask?.position ?? -1) + 1,
    })
    .returning({ id: tasks.id });

  return { id: created.id };
}

export async function updateTaskCore(
  input: z.input<typeof updateTaskSchema>,
  space: MutationSpace,
) {
  const values = updateTaskSchema.parse(input);
  await assertProjectOwned(values.projectId, space);
  await assertColumnInProject(values.columnId, values.projectId);
  const existingTask = await assertTaskInProject(values.taskId, values.projectId);
  await assertSpacePermission(space, "task", "update", values.projectId);

  const tagId = await resolveTagId(values, space);
  const movedColumn = existingTask.columnId !== values.columnId;

  await db.transaction(async (tx) => {
    let positionUpdate: number | undefined;

    if (movedColumn) {
      const [lastTask] = await tx
        .select({ position: tasks.position })
        .from(tasks)
        .where(eq(tasks.columnId, values.columnId))
        .orderBy(desc(tasks.position))
        .limit(1);

      positionUpdate = (lastTask?.position ?? -1) + 1;
    }

    await tx
      .update(tasks)
      .set({
        title: values.title,
        shortDescription: values.shortDescription || null,
        description: values.description || null,
        notes: values.notes || null,
        priority: values.priority,
        dueDate: parseOptionalDate(values.dueDate),
        columnId: values.columnId,
        tagId,
        ...(positionUpdate !== undefined ? { position: positionUpdate } : {}),
      })
      .where(eq(tasks.id, values.taskId));

    if (movedColumn) {
      const previousColumnTasks = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.columnId, existingTask.columnId))
        .orderBy(asc(tasks.position));

      for (const [index, task] of previousColumnTasks.entries()) {
        await tx
          .update(tasks)
          .set({ position: index })
          .where(eq(tasks.id, task.id));
      }
    }
  });
}

export async function deleteTaskCore(
  input: { projectId: string; taskId: string },
  space: MutationSpace,
) {
  await assertProjectOwned(input.projectId, space);
  const task = await assertTaskInProject(input.taskId, input.projectId);
  await assertSpacePermission(space, "task", "delete", input.projectId);

  await db.transaction(async (tx) => {
    await tx.delete(tasks).where(eq(tasks.id, input.taskId));

    const remaining = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.columnId, task.columnId))
      .orderBy(asc(tasks.position));

    for (const [index, current] of remaining.entries()) {
      await tx
        .update(tasks)
        .set({ position: index })
        .where(eq(tasks.id, current.id));
    }
  });
}

// The status-move/reorder mutation: splice the task into the target column at
// toIndex using two-phase position parking so the (columnId, position) unique
// constraint never trips mid-transaction.
export async function moveTaskCore(
  input: z.input<typeof moveTaskSchema>,
  space: MutationSpace,
) {
  const values = moveTaskSchema.parse(input);
  await assertProjectOwned(values.projectId, space);
  // The destination column must live in the same owned project, so a move can
  // never relocate a card into another user's board.
  await assertColumnInProject(values.toColumnId, values.projectId);
  await assertSpacePermission(space, "task", "update", values.projectId);

  await db.transaction(async (tx) => {
    const task = await tx.query.tasks.findFirst({
      where: and(eq(tasks.id, values.taskId), eq(tasks.projectId, values.projectId)),
      columns: { id: true, columnId: true },
    });

    if (!task) {
      return;
    }

    const sourceColumnId = task.columnId;
    const sameColumn = sourceColumnId === values.toColumnId;

    // Final ordering for the target column: existing tasks (minus the moved
    // one) with the moved task spliced in at toIndex.
    const targetTasks = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.columnId, values.toColumnId))
      .orderBy(asc(tasks.position));

    const targetOrder = targetTasks
      .map((t) => t.id)
      .filter((id) => id !== values.taskId);
    const insertAt = Math.min(values.toIndex, targetOrder.length);
    targetOrder.splice(insertAt, 0, values.taskId);

    // Source column final ordering (only relevant on a cross-column move).
    const sourceOrder = sameColumn
      ? []
      : (
          await tx
            .select({ id: tasks.id })
            .from(tasks)
            .where(eq(tasks.columnId, sourceColumnId))
            .orderBy(asc(tasks.position))
        )
          .map((t) => t.id)
          .filter((id) => id !== values.taskId);

    // Phase 1: park every affected task at a high, still-unique position so the
    // final assignment below can't collide on (columnId, position).
    const affectedIds = sameColumn ? targetOrder : [...sourceOrder, ...targetOrder];
    for (const [index, id] of affectedIds.entries()) {
      await tx
        .update(tasks)
        .set({ position: POSITION_OFFSET + index })
        .where(eq(tasks.id, id));
    }

    // Phase 2: assign contiguous final positions; the moved task also adopts
    // the target column id.
    for (const [index, id] of sourceOrder.entries()) {
      await tx
        .update(tasks)
        .set({ position: index, columnId: sourceColumnId })
        .where(eq(tasks.id, id));
    }

    for (const [index, id] of targetOrder.entries()) {
      await tx
        .update(tasks)
        .set({ position: index, columnId: values.toColumnId })
        .where(eq(tasks.id, id));
    }
  });
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export async function createSectionCore(
  input: z.input<typeof createSectionSchema>,
  space: MutationSpace,
) {
  await assertSpacePermission(space, "section", "create");
  const values = createSectionSchema.parse(input);
  if (values.parentId) {
    await assertSectionOwned(values.parentId, space);
  }

  const slug = await resolveUniqueSlug(values.name, "sections", space);
  const tagId = await resolveTagId(values, space);

  const [lastSection] = await db
    .select({ position: sections.position })
    .from(sections)
    .where(sectionScope(space))
    .orderBy(desc(sections.position))
    .limit(1);

  const [section] = await db
    .insert(sections)
    .values({
      name: values.name,
      slug,
      description: values.description || null,
      parentId: values.parentId || null,
      tagId,
      ...spaceOwnership(space),
      position: (lastSection?.position ?? -1) + 1,
    })
    .returning({ id: sections.id });

  return { id: section.id, slug };
}

export async function updateSectionCore(
  input: z.input<typeof updateSectionSchema>,
  space: MutationSpace,
) {
  await assertSpacePermission(space, "section", "update");
  const values = updateSectionSchema.parse(input);
  await assertSectionOwned(values.sectionId, space);

  const newParentId = values.parentId || null;
  if (newParentId) {
    await assertSectionOwned(newParentId, space);
  }

  // Cycle guard: a section can't be its own parent, nor be moved under one of
  // its own descendants (the self-FK alone does not prevent cycles). Walk up
  // from the proposed parent; if we reach this section, the move is a cycle.
  if (newParentId) {
    if (newParentId === values.sectionId) {
      throw new MutationError("A section cannot be its own parent.", "invalid");
    }
    const all = await db.query.sections.findMany({
      where: sectionScope(space),
      columns: { id: true, parentId: true },
    });
    const parentOf = new Map(all.map((section) => [section.id, section.parentId]));
    let cursor: string | null | undefined = newParentId;
    while (cursor) {
      if (cursor === values.sectionId) {
        throw new MutationError(
          "Cannot move a section under one of its own descendants.",
          "invalid",
        );
      }
      cursor = parentOf.get(cursor) ?? null;
    }
  }

  const existing = await db.query.sections.findFirst({
    where: and(eq(sections.id, values.sectionId), sectionScope(space)),
    columns: { name: true },
  });
  if (!existing) {
    throw new MutationError(`Section ${values.sectionId} not found`);
  }

  const slug =
    existing.name !== values.name
      ? await resolveUniqueSlug(values.name, "sections", space)
      : undefined;
  const tagId = await resolveTagId(values, space);

  await db
    .update(sections)
    .set({
      name: values.name,
      description: values.description || null,
      parentId: newParentId,
      tagId,
      ...(slug ? { slug } : {}),
    })
    .where(and(eq(sections.id, values.sectionId), sectionScope(space)));

  return { id: values.sectionId };
}

// Deleting a section relies on `onDelete: "set null"`: child sections are
// promoted to the top level and member projects are ungrouped — no tasks lost.
export async function deleteSectionCore(sectionId: string, space: MutationSpace) {
  await assertSpacePermission(space, "section", "delete");
  await assertSectionOwned(sectionId, space);
  await db.delete(sections).where(and(eq(sections.id, sectionId), sectionScope(space)));
}

// ---------------------------------------------------------------------------
// Story tasks (checklist items)
// ---------------------------------------------------------------------------

// Keep a story card's column in sync with its child tasks: when every child is
// done the card moves to the project's Done lane, and if a child is reopened a
// card sitting in Done moves back to the first non-Done lane. Stories without
// any child tasks are left where the user put them.
export async function syncStoryCompletion(storyId: string, projectId: string) {
  const story = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, storyId), eq(tasks.projectId, projectId)),
    columns: { id: true, columnId: true },
    with: {
      storyTasks: { columns: { isDone: true } },
    },
  });

  if (!story || story.storyTasks.length === 0) {
    return;
  }

  const allDone = story.storyTasks.every((child) => child.isDone);

  const projectColumns = await db
    .select({ id: columns.id, name: columns.name })
    .from(columns)
    .where(eq(columns.projectId, projectId))
    .orderBy(asc(columns.position));

  const doneColumn = projectColumns.find(
    (column) => statusKeyFromColumnName(column.name) === "done",
  );
  if (!doneColumn) {
    return;
  }

  let targetColumnId: string | undefined;
  if (allDone && story.columnId !== doneColumn.id) {
    targetColumnId = doneColumn.id;
  } else if (!allDone && story.columnId === doneColumn.id) {
    const firstNonDone = projectColumns.find((column) => column.id !== doneColumn.id);
    targetColumnId = firstNonDone?.id;
  }

  if (!targetColumnId || targetColumnId === story.columnId) {
    return;
  }

  const sourceColumnId = story.columnId;
  const destinationColumnId = targetColumnId;

  await db.transaction(async (tx) => {
    const [lastTask] = await tx
      .select({ position: tasks.position })
      .from(tasks)
      .where(eq(tasks.columnId, destinationColumnId))
      .orderBy(desc(tasks.position))
      .limit(1);

    await tx
      .update(tasks)
      .set({ columnId: destinationColumnId, position: (lastTask?.position ?? -1) + 1 })
      .where(eq(tasks.id, storyId));

    const previousColumnTasks = await tx
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.columnId, sourceColumnId))
      .orderBy(asc(tasks.position));

    for (const [index, task] of previousColumnTasks.entries()) {
      await tx.update(tasks).set({ position: index }).where(eq(tasks.id, task.id));
    }
  });
}

export async function createStoryTaskCore(
  input: z.input<typeof createStoryTaskSchema>,
  space: MutationSpace,
) {
  const values = createStoryTaskSchema.parse(input);
  await assertProjectOwned(values.projectId, space);
  await assertTaskInProject(values.taskId, values.projectId);
  const tagId = await resolveTagId(values, space);

  const [lastChild] = await db
    .select({ position: storyTasks.position })
    .from(storyTasks)
    .where(eq(storyTasks.taskId, values.taskId))
    .orderBy(desc(storyTasks.position))
    .limit(1);

  const [created] = await db
    .insert(storyTasks)
    .values({
      title: values.title,
      description: values.description || null,
      priority: values.priority,
      dueDate: parseOptionalDate(values.dueDate),
      taskId: values.taskId,
      tagId,
      position: (lastChild?.position ?? -1) + 1,
    })
    .returning({ id: storyTasks.id });

  // A newly added (incomplete) child can take a completed story out of Done.
  await syncStoryCompletion(values.taskId, values.projectId);

  return { id: created.id };
}

export async function updateStoryTaskCore(
  input: z.input<typeof updateStoryTaskSchema>,
  space: MutationSpace,
) {
  const values = updateStoryTaskSchema.parse(input);
  await assertProjectOwned(values.projectId, space);
  await assertTaskInProject(values.taskId, values.projectId);
  const tagId = await resolveTagId(values, space);

  await db
    .update(storyTasks)
    .set({
      title: values.title,
      description: values.description || null,
      priority: values.priority,
      dueDate: parseOptionalDate(values.dueDate),
      tagId,
    })
    .where(and(eq(storyTasks.id, values.storyTaskId), eq(storyTasks.taskId, values.taskId)));
}

export async function updateStoryTasksBatchCore(
  input: z.input<typeof updateStoryTasksBatchSchema>,
  space: MutationSpace,
) {
  const values = updateStoryTasksBatchSchema.parse(input);
  await assertProjectOwned(values.projectId, space);
  await assertTaskInProject(values.taskId, values.projectId);

  // Tag resolution stays outside the transaction — see resolveTagId's doc
  // comment above (tag rows live independently of the item).
  const resolved = await Promise.all(
    values.items.map(async (item) => ({ item, tagId: await resolveTagId(item, space) })),
  );

  await db.transaction(async (tx) => {
    for (const { item, tagId } of resolved) {
      await tx
        .update(storyTasks)
        .set({
          title: item.title,
          description: item.description || null,
          priority: item.priority,
          dueDate: parseOptionalDate(item.dueDate),
          tagId,
        })
        .where(and(eq(storyTasks.id, item.storyTaskId), eq(storyTasks.taskId, values.taskId)));
    }
  });
}

export async function toggleStoryTaskCore(
  input: z.input<typeof toggleStoryTaskSchema>,
  space: MutationSpace,
) {
  const values = toggleStoryTaskSchema.parse(input);
  await assertProjectOwned(values.projectId, space);
  await assertTaskInProject(values.taskId, values.projectId);

  await db
    .update(storyTasks)
    .set({ isDone: values.isDone })
    .where(and(eq(storyTasks.id, values.storyTaskId), eq(storyTasks.taskId, values.taskId)));

  await syncStoryCompletion(values.taskId, values.projectId);
}

export async function deleteStoryTaskCore(
  input: { projectId: string; taskId: string; storyTaskId: string },
  space: MutationSpace,
) {
  await assertProjectOwned(input.projectId, space);
  await assertTaskInProject(input.taskId, input.projectId);

  await db
    .delete(storyTasks)
    .where(and(eq(storyTasks.id, input.storyTaskId), eq(storyTasks.taskId, input.taskId)));

  const remaining = await db
    .select({ id: storyTasks.id })
    .from(storyTasks)
    .where(eq(storyTasks.taskId, input.taskId))
    .orderBy(asc(storyTasks.position));

  for (const [index, child] of remaining.entries()) {
    await db.update(storyTasks).set({ position: index }).where(eq(storyTasks.id, child.id));
  }

  // Removing the last incomplete child may complete the story (auto-move to Done).
  await syncStoryCompletion(input.taskId, input.projectId);
}
