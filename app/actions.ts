"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq, ilike, inArray } from "drizzle-orm";
import { z } from "zod";

import { getCurrentUserId } from "@/lib/auth-session";
import { COLUMN_COLOR_OPTIONS, DEFAULT_COLUMNS, TAG_COLOR_OPTIONS } from "@/lib/constants";
import { getTags, statusKeyFromColumnName } from "@/lib/data";
import { db } from "@/lib/db";
import { columns, PRIORITY_VALUES, projects, sections, storyTasks, tags, tasks } from "@/lib/db/schema";
import { slugify } from "@/lib/utils/slugify";

// ---------------------------------------------------------------------------
// Authorization helpers. Every mutation resolves the signed-in user first, then
// asserts that the project/section/task it targets belongs to that user before
// touching any row. Ownership roots at Project/Section (both carry userId);
// columns/tasks/storyTasks are authorized transitively through their project.
// A mismatch throws notFound() — an attacker guessing another user's id gets a
// 404, never a mutation.
// ---------------------------------------------------------------------------

async function assertProjectOwned(projectId: string, uid: string) {
  const owned = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, uid)),
    columns: { id: true },
  });
  if (!owned) notFound();
}

async function assertSectionOwned(sectionId: string, uid: string) {
  const owned = await db.query.sections.findFirst({
    where: and(eq(sections.id, sectionId), eq(sections.userId, uid)),
    columns: { id: true },
  });
  if (!owned) notFound();
}

// Assumes the project was already asserted owned; confirms the column lives in it.
async function assertColumnInProject(columnId: string, projectId: string) {
  const owned = await db.query.columns.findFirst({
    where: and(eq(columns.id, columnId), eq(columns.projectId, projectId)),
    columns: { id: true },
  });
  if (!owned) notFound();
}

// Assumes the project was already asserted owned; confirms the task lives in it
// and returns it (with columnId) for callers that need to re-sequence positions.
async function assertTaskInProject(taskId: string, projectId: string) {
  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)),
    columns: { id: true, columnId: true },
  });
  if (!task) notFound();
  return task;
}

// Tag fields shared by every create/edit form. The picker emits either a chosen
// `tagId` or a new `tagName` (+ optional `tagColor`); both are optional.
const tagFields = {
  tagId: z.string().optional(),
  tagName: z.string().trim().max(40).optional(),
  tagColor: z.string().optional(),
};

function readTagFields(formData: FormData) {
  return {
    tagId: (formData.get("tagId") as string) || undefined,
    tagName: (formData.get("tagName") as string) || undefined,
    tagColor: (formData.get("tagColor") as string) || undefined,
  };
}

// Resolve the single tag for an item: use the chosen id, else find-or-create by
// name (case-insensitive), else leave it untagged. Tag rows live independently
// of the item so this runs outside the item's transaction.
async function resolveTagId(
  input: {
    tagId?: string;
    tagName?: string;
    tagColor?: string;
  },
  uid: string,
): Promise<string | null> {
  if (input.tagId) {
    // A chosen tag must belong to this user, else ignore it (never adopt
    // another user's tag onto an item).
    const owned = await db.query.tags.findFirst({
      where: and(eq(tags.id, input.tagId), eq(tags.userId, uid)),
      columns: { id: true },
    });
    return owned?.id ?? null;
  }

  const name = input.tagName?.trim();
  if (!name) {
    return null;
  }

  const existing = await db.query.tags.findFirst({
    where: and(ilike(tags.name, name), eq(tags.userId, uid)),
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
      .values({ name, color, userId: uid })
      .returning({ id: tags.id });
    return created.id;
  } catch {
    // Lost a race on the (userId, name) unique — re-read the winner.
    const fallback = await db.query.tags.findFirst({
      where: and(ilike(tags.name, name), eq(tags.userId, uid)),
      columns: { id: true },
    });
    return fallback?.id ?? null;
  }
}

const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  sectionId: z.string().optional(),
  ...tagFields,
});

const createColumnSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(2).max(40),
  color: z.enum(COLUMN_COLOR_OPTIONS).optional(),
});

const updateColumnSchema = z.object({
  projectId: z.string().min(1),
  columnId: z.string().min(1),
  name: z.string().trim().min(2).max(40),
  color: z.enum(COLUMN_COLOR_OPTIONS),
});

const deleteColumnSchema = z.object({
  projectId: z.string().min(1),
  columnId: z.string().min(1),
});

const createTaskSchema = z.object({
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

const updateTaskSchema = z.object({
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

const moveTaskSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  toColumnId: z.string().min(1),
  toIndex: z.number().int().min(0),
});

const createStoryTaskSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(600).optional(),
  priority: z.enum(PRIORITY_VALUES),
  dueDate: z.string().optional(),
  ...tagFields,
});

const updateStoryTaskSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  storyTaskId: z.string().min(1),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(600).optional(),
  priority: z.enum(PRIORITY_VALUES),
  dueDate: z.string().optional(),
  ...tagFields,
});

const toggleStoryTaskSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  storyTaskId: z.string().min(1),
  isDone: z.enum(["true", "false"]),
});

const deleteStoryTaskSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  storyTaskId: z.string().min(1),
});

// Large offset used to temporarily park positions out of the way so that
// reordering within a column never trips the (columnId, position) unique
// constraint mid-transaction.
const POSITION_OFFSET = 1_000_000;

function parseOptionalDate(value?: string) {
  if (!value?.trim()) {
    return null;
  }

  return new Date(`${value}T00:00:00.000Z`);
}

async function slugExists(slug: string, table: "projects" | "sections", uid: string) {
  if (table === "sections") {
    return Boolean(
      await db.query.sections.findFirst({
        where: and(eq(sections.slug, slug), eq(sections.userId, uid)),
        columns: { id: true },
      }),
    );
  }
  return Boolean(
    await db.query.projects.findFirst({
      where: and(eq(projects.slug, slug), eq(projects.userId, uid)),
      columns: { id: true },
    }),
  );
}

// Projects and sections own separate slug spaces, now scoped per user; pass the
// table and owner so the uniqueness check (and fallback base) targets the right
// one within that user's data.
async function resolveUniqueSlug(
  name: string,
  table: "projects" | "sections",
  uid: string,
) {
  const baseSlug = slugify(name) || (table === "sections" ? "section" : "project");
  let slug = baseSlug;
  let suffix = 1;

  while (await slugExists(slug, table, uid)) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  return slug;
}

export async function createProject(formData: FormData) {
  const values = createProjectSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    sectionId: (formData.get("sectionId") as string) || undefined,
    ...readTagFields(formData),
  });

  const uid = await getCurrentUserId();
  if (values.sectionId) {
    await assertSectionOwned(values.sectionId, uid);
  }

  const slug = await resolveUniqueSlug(values.name, "projects", uid);
  const tagId = await resolveTagId(values, uid);

  const project = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(projects)
      .values({
        name: values.name,
        slug,
        description: values.description || null,
        tagId,
        sectionId: values.sectionId || null,
        userId: uid,
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

  revalidatePath("/");
  redirect(`/projects/${project.id}`);
}

export async function createColumn(formData: FormData) {
  const values = createColumnSchema.parse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    color: formData.get("color") || undefined,
  });

  const uid = await getCurrentUserId();
  await assertProjectOwned(values.projectId, uid);

  const [lastColumn] = await db
    .select({ position: columns.position })
    .from(columns)
    .where(eq(columns.projectId, values.projectId))
    .orderBy(desc(columns.position))
    .limit(1);

  await db.insert(columns).values({
    projectId: values.projectId,
    name: values.name,
    color: values.color ?? COLUMN_COLOR_OPTIONS[0],
    position: (lastColumn?.position ?? -1) + 1,
  });

  revalidatePath(`/projects/${values.projectId}`);
  redirect(`/projects/${values.projectId}`);
}

export async function updateColumn(formData: FormData) {
  const values = updateColumnSchema.parse({
    projectId: formData.get("projectId"),
    columnId: formData.get("columnId"),
    name: formData.get("name"),
    color: formData.get("color"),
  });

  const uid = await getCurrentUserId();
  await assertProjectOwned(values.projectId, uid);
  await assertColumnInProject(values.columnId, values.projectId);

  await db
    .update(columns)
    .set({ name: values.name, color: values.color })
    .where(and(eq(columns.id, values.columnId), eq(columns.projectId, values.projectId)));

  revalidatePath(`/projects/${values.projectId}`);
  redirect(`/projects/${values.projectId}`);
}

export async function deleteColumn(formData: FormData) {
  const values = deleteColumnSchema.parse({
    projectId: formData.get("projectId"),
    columnId: formData.get("columnId"),
  });

  const uid = await getCurrentUserId();
  await assertProjectOwned(values.projectId, uid);
  await assertColumnInProject(values.columnId, values.projectId);

  const projectColumns = await db
    .select({ id: columns.id, position: columns.position })
    .from(columns)
    .where(eq(columns.projectId, values.projectId))
    .orderBy(asc(columns.position));

  if (projectColumns.length <= 1) {
    revalidatePath(`/projects/${values.projectId}`);
    redirect(`/projects/${values.projectId}`);
  }

  const fallbackColumn = projectColumns.find(
    (column) => column.id !== values.columnId,
  );

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
        .where(eq(tasks.columnId, values.columnId))
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

    await tx.delete(columns).where(eq(columns.id, values.columnId));

    const remaining = await tx
      .select({ id: columns.id })
      .from(columns)
      .where(eq(columns.projectId, values.projectId))
      .orderBy(asc(columns.position));

    for (const [index, column] of remaining.entries()) {
      await tx
        .update(columns)
        .set({ position: index })
        .where(eq(columns.id, column.id));
    }
  });

  revalidatePath(`/projects/${values.projectId}`);
  redirect(`/projects/${values.projectId}`);
}

export async function createTask(formData: FormData) {
  const values = createTaskSchema.parse({
    projectId: formData.get("projectId"),
    columnId: formData.get("columnId"),
    title: formData.get("title"),
    shortDescription: formData.get("shortDescription") || undefined,
    description: formData.get("description") || undefined,
    notes: formData.get("notes") || undefined,
    priority: formData.get("priority"),
    dueDate: formData.get("dueDate") || undefined,
    ...readTagFields(formData),
  });

  const uid = await getCurrentUserId();
  await assertProjectOwned(values.projectId, uid);
  await assertColumnInProject(values.columnId, values.projectId);

  const tagId = await resolveTagId(values, uid);

  const [lastTask] = await db
    .select({ position: tasks.position })
    .from(tasks)
    .where(eq(tasks.columnId, values.columnId))
    .orderBy(desc(tasks.position))
    .limit(1);

  await db.insert(tasks).values({
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
  });

  revalidatePath(`/projects/${values.projectId}`);
  redirect(`/projects/${values.projectId}`);
}

export async function updateTask(formData: FormData) {
  const values = updateTaskSchema.parse({
    projectId: formData.get("projectId"),
    taskId: formData.get("taskId"),
    title: formData.get("title"),
    shortDescription: formData.get("shortDescription") || undefined,
    description: formData.get("description") || undefined,
    notes: formData.get("notes") || undefined,
    priority: formData.get("priority"),
    columnId: formData.get("columnId"),
    dueDate: formData.get("dueDate") || undefined,
    ...readTagFields(formData),
  });

  const uid = await getCurrentUserId();
  await assertProjectOwned(values.projectId, uid);
  await assertColumnInProject(values.columnId, values.projectId);
  const existingTask = await assertTaskInProject(values.taskId, values.projectId);

  const tagId = await resolveTagId(values, uid);
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

  revalidatePath(`/projects/${values.projectId}`);
}

export async function deleteTask(formData: FormData) {
  const projectId = z.string().min(1).parse(formData.get("projectId"));
  const taskId = z.string().min(1).parse(formData.get("taskId"));

  const uid = await getCurrentUserId();
  await assertProjectOwned(projectId, uid);
  const task = await assertTaskInProject(taskId, projectId);

  await db.transaction(async (tx) => {
    await tx.delete(tasks).where(eq(tasks.id, taskId));

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

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function moveTask(input: z.infer<typeof moveTaskSchema>) {
  const values = moveTaskSchema.parse(input);

  const uid = await getCurrentUserId();
  await assertProjectOwned(values.projectId, uid);
  // The destination column must live in the same owned project, so a move can
  // never relocate a card into another user's board.
  await assertColumnInProject(values.toColumnId, values.projectId);

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
    const affectedIds = sameColumn
      ? targetOrder
      : [...sourceOrder, ...targetOrder];
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

  revalidatePath(`/projects/${values.projectId}`);
}

const reorderProjectsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export async function reorderProjects(input: z.infer<typeof reorderProjectsSchema>) {
  const { orderedIds } = reorderProjectsSchema.parse(input);

  const uid = await getCurrentUserId();
  // Every id must be one of this user's projects, or the reorder is rejected
  // wholesale — no partial writes that could touch someone else's rows.
  const owned = await db.query.projects.findMany({
    where: and(inArray(projects.id, orderedIds), eq(projects.userId, uid)),
    columns: { id: true },
  });
  if (owned.length !== orderedIds.length) {
    notFound();
  }

  await db.transaction(async (tx) => {
    // Phase 1: park every project at a high, still-unique position so the final
    // pass below can't collide while positions are being shuffled.
    for (const [index, id] of orderedIds.entries()) {
      await tx
        .update(projects)
        .set({ position: POSITION_OFFSET + index })
        .where(and(eq(projects.id, id), eq(projects.userId, uid)));
    }

    // Phase 2: assign contiguous final positions matching the requested order.
    for (const [index, id] of orderedIds.entries()) {
      await tx
        .update(projects)
        .set({ position: index })
        .where(and(eq(projects.id, id), eq(projects.userId, uid)));
    }
  });

  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// Sections: nested groups of projects.
// ---------------------------------------------------------------------------

const createSectionSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  parentId: z.string().optional(),
  ...tagFields,
});

export async function createSection(formData: FormData) {
  const values = createSectionSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    parentId: (formData.get("parentId") as string) || undefined,
    ...readTagFields(formData),
  });

  const uid = await getCurrentUserId();
  if (values.parentId) {
    await assertSectionOwned(values.parentId, uid);
  }

  const slug = await resolveUniqueSlug(values.name, "sections", uid);
  const tagId = await resolveTagId(values, uid);

  const [lastSection] = await db
    .select({ position: sections.position })
    .from(sections)
    .where(eq(sections.userId, uid))
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
      userId: uid,
      position: (lastSection?.position ?? -1) + 1,
    })
    .returning({ id: sections.id });

  revalidatePath("/");
  redirect(`/sections/${section.id}`);
}

const updateSectionSchema = z.object({
  sectionId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  parentId: z.string().optional(),
  ...tagFields,
});

export async function updateSection(formData: FormData) {
  const values = updateSectionSchema.parse({
    sectionId: formData.get("sectionId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    parentId: (formData.get("parentId") as string) || undefined,
    ...readTagFields(formData),
  });

  const uid = await getCurrentUserId();
  await assertSectionOwned(values.sectionId, uid);

  const newParentId = values.parentId || null;
  if (newParentId) {
    await assertSectionOwned(newParentId, uid);
  }

  // Cycle guard: a section can't be its own parent, nor be moved under one of
  // its own descendants (the self-FK alone does not prevent cycles). Walk up
  // from the proposed parent; if we reach this section, the move is a cycle.
  if (newParentId) {
    if (newParentId === values.sectionId) {
      throw new Error("A section cannot be its own parent.");
    }
    const all = await db.query.sections.findMany({
      where: eq(sections.userId, uid),
      columns: { id: true, parentId: true },
    });
    const parentOf = new Map(all.map((section) => [section.id, section.parentId]));
    let cursor: string | null | undefined = newParentId;
    while (cursor) {
      if (cursor === values.sectionId) {
        throw new Error("Cannot move a section under one of its own descendants.");
      }
      cursor = parentOf.get(cursor) ?? null;
    }
  }

  const existing = await db.query.sections.findFirst({
    where: and(eq(sections.id, values.sectionId), eq(sections.userId, uid)),
    columns: { name: true },
  });
  if (!existing) {
    redirect("/");
  }

  const slug =
    existing.name !== values.name
      ? await resolveUniqueSlug(values.name, "sections", uid)
      : undefined;
  const tagId = await resolveTagId(values, uid);

  await db
    .update(sections)
    .set({
      name: values.name,
      description: values.description || null,
      parentId: newParentId,
      tagId,
      ...(slug ? { slug } : {}),
    })
    .where(and(eq(sections.id, values.sectionId), eq(sections.userId, uid)));

  revalidatePath("/");
  redirect(`/sections/${values.sectionId}`);
}

const deleteSectionSchema = z.object({
  sectionId: z.string().min(1),
});

// Deleting a section relies on `onDelete: "set null"`: child sections are
// promoted to the top level and member projects are ungrouped — no tasks lost.
export async function deleteSection(formData: FormData) {
  const { sectionId } = deleteSectionSchema.parse({
    sectionId: formData.get("sectionId"),
  });

  const uid = await getCurrentUserId();
  await assertSectionOwned(sectionId, uid);

  await db.delete(sections).where(and(eq(sections.id, sectionId), eq(sections.userId, uid)));

  revalidatePath("/");
  redirect("/");
}

const updateProjectSectionSchema = z.object({
  projectId: z.string().min(1),
  sectionId: z.string().optional(),
});

// Move a project into a section (or ungroup it when sectionId is empty).
export async function updateProjectSection(formData: FormData) {
  const values = updateProjectSectionSchema.parse({
    projectId: formData.get("projectId"),
    sectionId: (formData.get("sectionId") as string) ?? "",
  });

  const uid = await getCurrentUserId();
  await assertProjectOwned(values.projectId, uid);
  if (values.sectionId) {
    await assertSectionOwned(values.sectionId, uid);
  }

  await db
    .update(projects)
    .set({ sectionId: values.sectionId || null })
    .where(and(eq(projects.id, values.projectId), eq(projects.userId, uid)));

  revalidatePath("/");
  redirect(`/projects/${values.projectId}`);
}

const moveProjectToSectionSchema = z.object({
  projectId: z.string().min(1),
  sectionId: z.string().nullable(),
});

// Plain-args variant of the above, callable from the sidebar project menu without
// a form and without redirecting (the menu just refreshes in place).
export async function moveProjectToSection(input: z.infer<typeof moveProjectToSectionSchema>) {
  const values = moveProjectToSectionSchema.parse(input);

  const uid = await getCurrentUserId();
  await assertProjectOwned(values.projectId, uid);
  if (values.sectionId) {
    await assertSectionOwned(values.sectionId, uid);
  }

  await db
    .update(projects)
    .set({ sectionId: values.sectionId || null })
    .where(and(eq(projects.id, values.projectId), eq(projects.userId, uid)));

  revalidatePath("/");
}

const updateProjectSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
  sectionId: z.string().optional(),
  ...tagFields,
});

// Edit a project's full details (name, description, section, tag) from the sidebar
// menu — the create form reused for editing. Re-slugs only when the name changes,
// and resolves the tag the same find-or-create way as creation.
export async function updateProject(formData: FormData) {
  const values = updateProjectSchema.parse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    sectionId: (formData.get("sectionId") as string) || undefined,
    ...readTagFields(formData),
  });

  const uid = await getCurrentUserId();
  await assertProjectOwned(values.projectId, uid);
  if (values.sectionId) {
    await assertSectionOwned(values.sectionId, uid);
  }

  const existing = await db.query.projects.findFirst({
    where: and(eq(projects.id, values.projectId), eq(projects.userId, uid)),
    columns: { name: true },
  });
  if (!existing) {
    redirect("/");
  }

  const slug =
    existing.name !== values.name
      ? await resolveUniqueSlug(values.name, "projects", uid)
      : undefined;
  const tagId = await resolveTagId(values, uid);

  await db
    .update(projects)
    .set({
      name: values.name,
      description: values.description || null,
      sectionId: values.sectionId || null,
      tagId,
      ...(slug ? { slug } : {}),
    })
    .where(and(eq(projects.id, values.projectId), eq(projects.userId, uid)));

  revalidatePath("/");
  revalidatePath(`/projects/${values.projectId}`);
}

const deleteProjectSchema = z.object({
  projectId: z.string().min(1),
});

// Delete a project and its entire board. Columns, tasks and story tasks are
// removed by the cascade FKs in the schema.
export async function deleteProject(formData: FormData) {
  const { projectId } = deleteProjectSchema.parse({
    projectId: formData.get("projectId"),
  });

  const uid = await getCurrentUserId();
  await assertProjectOwned(projectId, uid);

  await db.delete(projects).where(and(eq(projects.id, projectId), eq(projects.userId, uid)));

  revalidatePath("/");
  redirect("/");
}

// Keep a story card's column in sync with its child tasks: when every child is
// done the card moves to the project's Done lane, and if a child is reopened a
// card sitting in Done moves back to the first non-Done lane. Stories without
// any child tasks are left where the user put them.
async function syncStoryCompletion(storyId: string, projectId: string) {
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

export async function createStoryTask(formData: FormData) {
  const values = createStoryTaskSchema.parse({
    projectId: formData.get("projectId"),
    taskId: formData.get("taskId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    priority: formData.get("priority"),
    dueDate: formData.get("dueDate") || undefined,
    ...readTagFields(formData),
  });

  const uid = await getCurrentUserId();
  await assertProjectOwned(values.projectId, uid);
  await assertTaskInProject(values.taskId, values.projectId);
  const tagId = await resolveTagId(values, uid);

  const [lastChild] = await db
    .select({ position: storyTasks.position })
    .from(storyTasks)
    .where(eq(storyTasks.taskId, values.taskId))
    .orderBy(desc(storyTasks.position))
    .limit(1);

  await db.insert(storyTasks).values({
    title: values.title,
    description: values.description || null,
    priority: values.priority,
    dueDate: parseOptionalDate(values.dueDate),
    taskId: values.taskId,
    tagId,
    position: (lastChild?.position ?? -1) + 1,
  });

  // A newly added (incomplete) child can take a completed story out of Done.
  await syncStoryCompletion(values.taskId, values.projectId);

  revalidatePath(`/projects/${values.projectId}`);
  redirect(`/projects/${values.projectId}?task=${values.taskId}`);
}

// Same as createStoryTask but stays on the board (no redirect into the task
// details sheet) — used by the inline "Add task" form on Kanban cards.
export async function createStoryTaskOnBoard(formData: FormData) {
  const values = createStoryTaskSchema.parse({
    projectId: formData.get("projectId"),
    taskId: formData.get("taskId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    priority: formData.get("priority"),
    dueDate: formData.get("dueDate") || undefined,
    ...readTagFields(formData),
  });

  const uid = await getCurrentUserId();
  await assertProjectOwned(values.projectId, uid);
  await assertTaskInProject(values.taskId, values.projectId);
  const tagId = await resolveTagId(values, uid);

  const [lastChild] = await db
    .select({ position: storyTasks.position })
    .from(storyTasks)
    .where(eq(storyTasks.taskId, values.taskId))
    .orderBy(desc(storyTasks.position))
    .limit(1);

  await db.insert(storyTasks).values({
    title: values.title,
    description: values.description || null,
    priority: values.priority,
    dueDate: parseOptionalDate(values.dueDate),
    taskId: values.taskId,
    tagId,
    position: (lastChild?.position ?? -1) + 1,
  });

  // A newly added (incomplete) child can take a completed story out of Done.
  await syncStoryCompletion(values.taskId, values.projectId);

  revalidatePath(`/projects/${values.projectId}`);
}

export async function updateStoryTask(formData: FormData) {
  const values = updateStoryTaskSchema.parse({
    projectId: formData.get("projectId"),
    taskId: formData.get("taskId"),
    storyTaskId: formData.get("storyTaskId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    priority: formData.get("priority"),
    dueDate: formData.get("dueDate") || undefined,
    ...readTagFields(formData),
  });

  const uid = await getCurrentUserId();
  await assertProjectOwned(values.projectId, uid);
  await assertTaskInProject(values.taskId, values.projectId);
  const tagId = await resolveTagId(values, uid);

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

  revalidatePath(`/projects/${values.projectId}`);
  redirect(`/projects/${values.projectId}?task=${values.taskId}`);
}

export async function toggleStoryTask(formData: FormData) {
  const values = toggleStoryTaskSchema.parse({
    projectId: formData.get("projectId"),
    taskId: formData.get("taskId"),
    storyTaskId: formData.get("storyTaskId"),
    isDone: formData.get("isDone"),
  });

  const uid = await getCurrentUserId();
  await assertProjectOwned(values.projectId, uid);
  await assertTaskInProject(values.taskId, values.projectId);

  await db
    .update(storyTasks)
    .set({ isDone: values.isDone === "true" })
    .where(and(eq(storyTasks.id, values.storyTaskId), eq(storyTasks.taskId, values.taskId)));

  await syncStoryCompletion(values.taskId, values.projectId);

  revalidatePath(`/projects/${values.projectId}`);
  redirect(`/projects/${values.projectId}?task=${values.taskId}`);
}

// Same as toggleStoryTask but stays on the board (no redirect into the task
// details sheet) — used by the inline checklist on Kanban cards.
export async function toggleStoryTaskOnBoard(formData: FormData) {
  const values = toggleStoryTaskSchema.parse({
    projectId: formData.get("projectId"),
    taskId: formData.get("taskId"),
    storyTaskId: formData.get("storyTaskId"),
    isDone: formData.get("isDone"),
  });

  const uid = await getCurrentUserId();
  await assertProjectOwned(values.projectId, uid);
  await assertTaskInProject(values.taskId, values.projectId);

  await db
    .update(storyTasks)
    .set({ isDone: values.isDone === "true" })
    .where(and(eq(storyTasks.id, values.storyTaskId), eq(storyTasks.taskId, values.taskId)));

  await syncStoryCompletion(values.taskId, values.projectId);

  revalidatePath(`/projects/${values.projectId}`);
}

export async function deleteStoryTask(formData: FormData) {
  const values = deleteStoryTaskSchema.parse({
    projectId: formData.get("projectId"),
    taskId: formData.get("taskId"),
    storyTaskId: formData.get("storyTaskId"),
  });

  const uid = await getCurrentUserId();
  await assertProjectOwned(values.projectId, uid);
  await assertTaskInProject(values.taskId, values.projectId);

  await db
    .delete(storyTasks)
    .where(and(eq(storyTasks.id, values.storyTaskId), eq(storyTasks.taskId, values.taskId)));

  const remaining = await db
    .select({ id: storyTasks.id })
    .from(storyTasks)
    .where(eq(storyTasks.taskId, values.taskId))
    .orderBy(asc(storyTasks.position));

  for (const [index, child] of remaining.entries()) {
    await db.update(storyTasks).set({ position: index }).where(eq(storyTasks.id, child.id));
  }

  // Removing the last incomplete child may complete the story (auto-move to Done).
  await syncStoryCompletion(values.taskId, values.projectId);

  revalidatePath(`/projects/${values.projectId}`);
  redirect(`/projects/${values.projectId}?task=${values.taskId}`);
}

const createTagSchema = z.object({
  name: z.string().trim().min(2).max(40),
  color: z.enum(TAG_COLOR_OPTIONS).optional(),
});

// Standalone tag creation (find-or-create by name) used by the tag picker's
// "new tag" flow. Returns the resolved tag so the client can select it.
export async function createTag(input: z.infer<typeof createTagSchema>) {
  const values = createTagSchema.parse(input);
  const uid = await getCurrentUserId();
  const tagId = await resolveTagId({ tagName: values.name, tagColor: values.color }, uid);
  if (!tagId) {
    throw new Error("Could not create tag");
  }
  const tag = await db.query.tags.findFirst({
    where: and(eq(tags.id, tagId), eq(tags.userId, uid)),
    columns: { id: true, name: true, color: true },
  });
  return tag!;
}

// Client-callable wrapper so the tag picker can load the workspace tag pool
// without threading the list through every mount point as props.
export async function getTagsAction() {
  return getTags();
}
