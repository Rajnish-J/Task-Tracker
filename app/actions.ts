"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { COLUMN_COLOR_OPTIONS, DEFAULT_COLUMNS } from "@/lib/constants";
import { db } from "@/lib/db";
import { columns, PRIORITY_VALUES, projects, tasks } from "@/lib/db/schema";
import { slugify } from "@/lib/utils/slugify";

const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(240).optional(),
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
});

const moveTaskSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  toColumnId: z.string().min(1),
  toIndex: z.number().int().min(0),
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

async function resolveUniqueSlug(name: string) {
  const baseSlug = slugify(name) || "project";
  let slug = baseSlug;
  let suffix = 1;

  while (
    await db.query.projects.findFirst({
      where: eq(projects.slug, slug),
      columns: { id: true },
    })
  ) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  return slug;
}

export async function createProject(formData: FormData) {
  const values = createProjectSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  const slug = await resolveUniqueSlug(values.name);

  const project = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(projects)
      .values({
        name: values.name,
        slug,
        description: values.description || null,
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

  await db
    .update(columns)
    .set({ name: values.name, color: values.color })
    .where(eq(columns.id, values.columnId));

  revalidatePath(`/projects/${values.projectId}`);
  redirect(`/projects/${values.projectId}`);
}

export async function deleteColumn(formData: FormData) {
  const values = deleteColumnSchema.parse({
    projectId: formData.get("projectId"),
    columnId: formData.get("columnId"),
  });

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
  });

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
  });

  const existingTask = await db.query.tasks.findFirst({
    where: eq(tasks.id, values.taskId),
    columns: { columnId: true },
  });

  if (!existingTask) {
    redirect(`/projects/${values.projectId}`);
  }

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
  redirect(`/projects/${values.projectId}?task=${values.taskId}`);
}

export async function deleteTask(formData: FormData) {
  const projectId = z.string().min(1).parse(formData.get("projectId"));
  const taskId = z.string().min(1).parse(formData.get("taskId"));

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    columns: { columnId: true },
  });

  if (!task) {
    redirect(`/projects/${projectId}`);
  }

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
