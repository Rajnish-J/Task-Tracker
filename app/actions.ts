"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Priority } from "@prisma/client";
import { z } from "zod";

import { COLUMN_COLOR_OPTIONS, DEFAULT_COLUMNS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
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
  description: z.string().trim().max(600).optional(),
  notes: z.string().trim().max(1200).optional(),
  priority: z.nativeEnum(Priority),
  dueDate: z.string().optional(),
});

const updateTaskSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(600).optional(),
  notes: z.string().trim().max(1200).optional(),
  priority: z.nativeEnum(Priority),
  columnId: z.string().min(1),
  dueDate: z.string().optional(),
});

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

  while (await prisma.project.findUnique({ where: { slug } })) {
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

  const project = await prisma.project.create({
    data: {
      name: values.name,
      slug,
      description: values.description || null,
      columns: {
        create: DEFAULT_COLUMNS.map((column, index) => ({
          name: column.name,
          color: column.color,
          position: index,
        })),
      },
    },
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

  const lastColumn = await prisma.column.findFirst({
    where: { projectId: values.projectId },
    orderBy: { position: "desc" },
  });

  await prisma.column.create({
    data: {
      projectId: values.projectId,
      name: values.name,
      color: values.color ?? COLUMN_COLOR_OPTIONS[0],
      position: (lastColumn?.position ?? -1) + 1,
    },
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

  await prisma.column.update({
    where: { id: values.columnId },
    data: {
      name: values.name,
      color: values.color,
    },
  });

  revalidatePath(`/projects/${values.projectId}`);
  redirect(`/projects/${values.projectId}`);
}

export async function deleteColumn(formData: FormData) {
  const values = deleteColumnSchema.parse({
    projectId: formData.get("projectId"),
    columnId: formData.get("columnId"),
  });

  const columns = await prisma.column.findMany({
    where: { projectId: values.projectId },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });

  if (columns.length <= 1) {
    revalidatePath(`/projects/${values.projectId}`);
    redirect(`/projects/${values.projectId}`);
  }

  const fallbackColumn = columns.find((column) => column.id !== values.columnId);

  await prisma.$transaction(async (tx) => {
    if (fallbackColumn) {
      const lastTask = await tx.task.findFirst({
        where: { columnId: fallbackColumn.id },
        orderBy: { position: "desc" },
        select: { position: true },
      });

      const tasksToMove = await tx.task.findMany({
        where: { columnId: values.columnId },
        orderBy: { position: "asc" },
        select: { id: true },
      });

      for (const [index, task] of tasksToMove.entries()) {
        await tx.task.update({
          where: { id: task.id },
          data: {
            columnId: fallbackColumn.id,
            position: (lastTask?.position ?? -1) + index + 1,
          },
        });
      }
    }

    await tx.column.delete({ where: { id: values.columnId } });

    const remaining = await tx.column.findMany({
      where: { projectId: values.projectId },
      orderBy: { position: "asc" },
      select: { id: true },
    });

    for (const [index, column] of remaining.entries()) {
      await tx.column.update({
        where: { id: column.id },
        data: { position: index },
      });
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
    description: formData.get("description") || undefined,
    notes: formData.get("notes") || undefined,
    priority: formData.get("priority"),
    dueDate: formData.get("dueDate") || undefined,
  });

  const lastTask = await prisma.task.findFirst({
    where: { columnId: values.columnId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.task.create({
    data: {
      title: values.title,
      description: values.description || null,
      notes: values.notes || null,
      priority: values.priority,
      dueDate: parseOptionalDate(values.dueDate),
      projectId: values.projectId,
      columnId: values.columnId,
      position: (lastTask?.position ?? -1) + 1,
    },
  });

  revalidatePath(`/projects/${values.projectId}`);
  redirect(`/projects/${values.projectId}`);
}

export async function updateTask(formData: FormData) {
  const values = updateTaskSchema.parse({
    projectId: formData.get("projectId"),
    taskId: formData.get("taskId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    notes: formData.get("notes") || undefined,
    priority: formData.get("priority"),
    columnId: formData.get("columnId"),
    dueDate: formData.get("dueDate") || undefined,
  });

  const existingTask = await prisma.task.findUniqueOrThrow({
    where: { id: values.taskId },
    select: { columnId: true },
  });

  await prisma.$transaction(async (tx) => {
    let positionUpdate: number | undefined;

    if (existingTask.columnId !== values.columnId) {
      const lastTask = await tx.task.findFirst({
        where: { columnId: values.columnId },
        orderBy: { position: "desc" },
        select: { position: true },
      });

      positionUpdate = (lastTask?.position ?? -1) + 1;
    }

    await tx.task.update({
      where: { id: values.taskId },
      data: {
        title: values.title,
        description: values.description || null,
        notes: values.notes || null,
        priority: values.priority,
        dueDate: parseOptionalDate(values.dueDate),
        columnId: values.columnId,
        ...(positionUpdate !== undefined ? { position: positionUpdate } : {}),
      },
    });

    if (existingTask.columnId !== values.columnId) {
      const previousColumnTasks = await tx.task.findMany({
        where: { columnId: existingTask.columnId },
        orderBy: { position: "asc" },
        select: { id: true },
      });

      for (const [index, task] of previousColumnTasks.entries()) {
        await tx.task.update({
          where: { id: task.id },
          data: { position: index },
        });
      }
    }
  });

  revalidatePath(`/projects/${values.projectId}`);
  redirect(`/projects/${values.projectId}?task=${values.taskId}`);
}

export async function deleteTask(formData: FormData) {
  const projectId = z.string().min(1).parse(formData.get("projectId"));
  const taskId = z.string().min(1).parse(formData.get("taskId"));

  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    select: { columnId: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.task.delete({ where: { id: taskId } });

    const remaining = await tx.task.findMany({
      where: { columnId: task.columnId },
      orderBy: { position: "asc" },
      select: { id: true },
    });

    for (const [index, current] of remaining.entries()) {
      await tx.task.update({
        where: { id: current.id },
        data: { position: index },
      });
    }
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}
