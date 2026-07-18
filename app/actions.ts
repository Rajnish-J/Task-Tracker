"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { TAG_COLOR_OPTIONS } from "@/lib/constants";
import { getTags } from "@/lib/data";
import { db } from "@/lib/db";
import {
  createColumnCore,
  createProjectCore,
  createSectionCore,
  createStoryTaskCore,
  createTaskCore,
  deleteColumnCore,
  deleteProjectCore,
  deleteSectionCore,
  deleteStoryTaskCore,
  deleteTagCore,
  deleteTaskCore,
  moveTaskCore,
  moveTaskSchema,
  MutationError,
  reorderProjectsCore,
  reorderProjectsSchema,
  resolveTagId,
  toggleStoryTaskCore,
  updateColumnCore,
  updateProjectCore,
  updateProjectSectionCore,
  updateSectionCore,
  updateStoryTaskCore,
  updateTaskCore,
} from "@/lib/db/mutations";
import { tags } from "@/lib/db/schema";
import { getSpaceContext } from "@/lib/space";

// ---------------------------------------------------------------------------
// Server actions are thin wrappers around the shared mutation core in
// lib/db/mutations.ts (also used by the chat assistant's tools). Each wrapper
// parses FormData, resolves the space it runs in (personal, or a team via the
// hidden teamId field the shared forms render), runs the core, then handles
// the Next.js-only concerns: MutationError("not_found") → notFound(), plus
// revalidatePath/redirect against the space's base path.
// ---------------------------------------------------------------------------

// Run a core mutation, translating ownership failures into the 404 the UI has
// always shown. Role failures ("forbidden") surface as a thrown error — the UI
// hides those affordances from members, so only a crafted request hits this.
// Other MutationErrors (e.g. cycle guard) propagate as errors.
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

// Resolve the space a form submission targets, plus the URL prefix for
// revalidation/redirects in that space ("" for personal, "/teams/:id" for a team).
async function resolveFormSpace(formData: FormData) {
  const teamId = (formData.get("teamId") as string) || undefined;
  const space = await getSpaceContext(teamId);
  return { space, base: teamId ? `/teams/${teamId}` : "" };
}

function spaceBase(teamId?: string | null) {
  return teamId ? `/teams/${teamId}` : "";
}

function readTagFields(formData: FormData) {
  return {
    tagId: (formData.get("tagId") as string) || undefined,
    tagName: (formData.get("tagName") as string) || undefined,
    tagColor: (formData.get("tagColor") as string) || undefined,
  };
}

export async function createProject(formData: FormData) {
  const { space, base } = await resolveFormSpace(formData);
  const project = await run(
    createProjectCore(
      {
        name: formData.get("name") as string,
        description: (formData.get("description") as string) || undefined,
        sectionId: (formData.get("sectionId") as string) || undefined,
        dueDate: (formData.get("dueDate") as string) || undefined,
        ...readTagFields(formData),
      },
      space,
    ),
  );

  revalidatePath(base || "/");
  redirect(`${base}/projects/${project.id}`);
}

export async function createColumn(formData: FormData) {
  const projectId = formData.get("projectId") as string;
  const { space, base } = await resolveFormSpace(formData);
  await run(
    createColumnCore(
      {
        projectId,
        name: formData.get("name") as string,
        color: (formData.get("color") as never) || undefined,
      },
      space,
    ),
  );

  revalidatePath(`${base}/projects/${projectId}`);
  redirect(`${base}/projects/${projectId}`);
}

export async function updateColumn(formData: FormData) {
  const projectId = formData.get("projectId") as string;
  const { space, base } = await resolveFormSpace(formData);
  await run(
    updateColumnCore(
      {
        projectId,
        columnId: formData.get("columnId") as string,
        name: formData.get("name") as string,
        color: formData.get("color") as never,
      },
      space,
    ),
  );

  revalidatePath(`${base}/projects/${projectId}`);
  redirect(`${base}/projects/${projectId}`);
}

export async function deleteColumn(formData: FormData) {
  const projectId = formData.get("projectId") as string;
  const columnId = formData.get("columnId") as string;

  const { space, base } = await resolveFormSpace(formData);
  try {
    await run(deleteColumnCore({ projectId, columnId }, space));
  } catch (error) {
    // Deleting the last column has always been a silent no-op in the UI.
    if (!(error instanceof MutationError && error.code === "invalid")) {
      throw error;
    }
  }

  revalidatePath(`${base}/projects/${projectId}`);
  redirect(`${base}/projects/${projectId}`);
}

export async function createTask(formData: FormData) {
  const projectId = formData.get("projectId") as string;
  const { space, base } = await resolveFormSpace(formData);
  await run(
    createTaskCore(
      {
        projectId,
        columnId: formData.get("columnId") as string,
        title: formData.get("title") as string,
        shortDescription: (formData.get("shortDescription") as string) || undefined,
        description: (formData.get("description") as string) || undefined,
        notes: (formData.get("notes") as string) || undefined,
        priority: formData.get("priority") as never,
        dueDate: (formData.get("dueDate") as string) || undefined,
        ...readTagFields(formData),
      },
      space,
    ),
  );

  revalidatePath(`${base}/projects/${projectId}`);
  redirect(`${base}/projects/${projectId}`);
}

export async function updateTask(formData: FormData) {
  const projectId = formData.get("projectId") as string;
  const { space, base } = await resolveFormSpace(formData);
  await run(
    updateTaskCore(
      {
        projectId,
        taskId: formData.get("taskId") as string,
        title: formData.get("title") as string,
        shortDescription: (formData.get("shortDescription") as string) || undefined,
        description: (formData.get("description") as string) || undefined,
        notes: (formData.get("notes") as string) || undefined,
        priority: formData.get("priority") as never,
        columnId: formData.get("columnId") as string,
        dueDate: (formData.get("dueDate") as string) || undefined,
        ...readTagFields(formData),
      },
      space,
    ),
  );

  revalidatePath(`${base}/projects/${projectId}`);
}

export async function deleteTask(formData: FormData) {
  const projectId = z.string().min(1).parse(formData.get("projectId"));
  const taskId = z.string().min(1).parse(formData.get("taskId"));

  const { space, base } = await resolveFormSpace(formData);
  await run(deleteTaskCore({ projectId, taskId }, space));

  revalidatePath(`${base}/projects/${projectId}`);
  redirect(`${base}/projects/${projectId}`);
}

export async function moveTask(input: z.infer<typeof moveTaskSchema>, teamId?: string) {
  const space = await getSpaceContext(teamId);
  await run(moveTaskCore(input, space));

  revalidatePath(`${spaceBase(teamId)}/projects/${input.projectId}`);
}

export async function reorderProjects(
  input: z.infer<typeof reorderProjectsSchema>,
  teamId?: string,
) {
  const space = await getSpaceContext(teamId);
  await run(reorderProjectsCore(input, space));

  revalidatePath(spaceBase(teamId) || "/");
}

// ---------------------------------------------------------------------------
// Sections: nested groups of projects.
// ---------------------------------------------------------------------------

export async function createSection(formData: FormData) {
  const { space, base } = await resolveFormSpace(formData);
  const section = await run(
    createSectionCore(
      {
        name: formData.get("name") as string,
        description: (formData.get("description") as string) || undefined,
        parentId: (formData.get("parentId") as string) || undefined,
        ...readTagFields(formData),
      },
      space,
    ),
  );

  revalidatePath(base || "/");
  redirect(`${base}/sections/${section.id}`);
}

export async function updateSection(formData: FormData) {
  const sectionId = formData.get("sectionId") as string;
  const { space, base } = await resolveFormSpace(formData);
  await run(
    updateSectionCore(
      {
        sectionId,
        name: formData.get("name") as string,
        description: (formData.get("description") as string) || undefined,
        parentId: (formData.get("parentId") as string) || undefined,
        ...readTagFields(formData),
      },
      space,
    ),
  );

  revalidatePath(base || "/");
  redirect(`${base}/sections/${sectionId}`);
}

// Deleting a section relies on `onDelete: "set null"`: child sections are
// promoted to the top level and member projects are ungrouped — no tasks lost.
export async function deleteSection(formData: FormData) {
  const sectionId = z.string().min(1).parse(formData.get("sectionId"));

  const { space, base } = await resolveFormSpace(formData);
  await run(deleteSectionCore(sectionId, space));

  revalidatePath(base || "/");
  redirect(base || "/");
}

// Move a project into a section (or ungroup it when sectionId is empty).
export async function updateProjectSection(formData: FormData) {
  const projectId = z.string().min(1).parse(formData.get("projectId"));
  const sectionId = ((formData.get("sectionId") as string) ?? "") || null;

  const { space, base } = await resolveFormSpace(formData);
  await run(updateProjectSectionCore({ projectId, sectionId }, space));

  revalidatePath(base || "/");
  redirect(`${base}/projects/${projectId}`);
}

const moveProjectToSectionSchema = z.object({
  projectId: z.string().min(1),
  sectionId: z.string().nullable(),
});

// Plain-args variant of the above, callable from the sidebar project menu without
// a form and without redirecting (the menu just refreshes in place).
export async function moveProjectToSection(
  input: z.infer<typeof moveProjectToSectionSchema>,
  teamId?: string,
) {
  const values = moveProjectToSectionSchema.parse(input);

  const space = await getSpaceContext(teamId);
  await run(updateProjectSectionCore(values, space));

  revalidatePath(spaceBase(teamId) || "/");
}

// Edit a project's full details (name, description, section, tag) from the sidebar
// menu — the create form reused for editing. Re-slugs only when the name changes,
// and resolves the tag the same find-or-create way as creation.
export async function updateProject(formData: FormData) {
  const projectId = formData.get("projectId") as string;
  const { space, base } = await resolveFormSpace(formData);
  await run(
    updateProjectCore(
      {
        projectId,
        name: formData.get("name") as string,
        description: (formData.get("description") as string) || undefined,
        sectionId: (formData.get("sectionId") as string) || undefined,
        dueDate: (formData.get("dueDate") as string) || undefined,
        ...readTagFields(formData),
      },
      space,
    ),
  );

  revalidatePath(base || "/");
  revalidatePath(`${base}/projects/${projectId}`);
}

// Delete a project and its entire board. Columns, tasks and story tasks are
// removed by the cascade FKs in the schema.
export async function deleteProject(formData: FormData) {
  const projectId = z.string().min(1).parse(formData.get("projectId"));

  const { space, base } = await resolveFormSpace(formData);
  await run(deleteProjectCore(projectId, space));

  revalidatePath(base || "/");
  redirect(base || "/");
}

// ---------------------------------------------------------------------------
// Story tasks (checklist items on a card).
// ---------------------------------------------------------------------------

function readStoryTaskFields(formData: FormData) {
  return {
    projectId: formData.get("projectId") as string,
    taskId: formData.get("taskId") as string,
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    priority: formData.get("priority") as never,
    dueDate: (formData.get("dueDate") as string) || undefined,
    ...readTagFields(formData),
  };
}

export async function createStoryTask(formData: FormData) {
  const values = readStoryTaskFields(formData);
  const { space, base } = await resolveFormSpace(formData);
  await run(createStoryTaskCore(values, space));

  revalidatePath(`${base}/projects/${values.projectId}`);
  redirect(`${base}/projects/${values.projectId}?task=${values.taskId}`);
}

// Same as createStoryTask but stays on the board (no redirect into the task
// details sheet) — used by the inline "Add task" form on Kanban cards.
export async function createStoryTaskOnBoard(formData: FormData) {
  const values = readStoryTaskFields(formData);
  const { space, base } = await resolveFormSpace(formData);
  await run(createStoryTaskCore(values, space));

  revalidatePath(`${base}/projects/${values.projectId}`);
}

export async function updateStoryTask(formData: FormData) {
  const values = {
    ...readStoryTaskFields(formData),
    storyTaskId: formData.get("storyTaskId") as string,
  };
  const { space, base } = await resolveFormSpace(formData);
  await run(updateStoryTaskCore(values, space));

  revalidatePath(`${base}/projects/${values.projectId}`);
  redirect(`${base}/projects/${values.projectId}?task=${values.taskId}`);
}

function readToggleStoryTaskFields(formData: FormData) {
  const parsed = z
    .object({
      projectId: z.string().min(1),
      taskId: z.string().min(1),
      storyTaskId: z.string().min(1),
      isDone: z.enum(["true", "false"]),
    })
    .parse({
      projectId: formData.get("projectId"),
      taskId: formData.get("taskId"),
      storyTaskId: formData.get("storyTaskId"),
      isDone: formData.get("isDone"),
    });
  return { ...parsed, isDone: parsed.isDone === "true" };
}

export async function toggleStoryTask(formData: FormData) {
  const values = readToggleStoryTaskFields(formData);
  const { space, base } = await resolveFormSpace(formData);
  await run(toggleStoryTaskCore(values, space));

  revalidatePath(`${base}/projects/${values.projectId}`);
  redirect(`${base}/projects/${values.projectId}?task=${values.taskId}`);
}

// Same as toggleStoryTask but stays on the board (no redirect into the task
// details sheet) — used by the inline checklist on Kanban cards.
export async function toggleStoryTaskOnBoard(formData: FormData) {
  const values = readToggleStoryTaskFields(formData);
  const { space, base } = await resolveFormSpace(formData);
  await run(toggleStoryTaskCore(values, space));

  revalidatePath(`${base}/projects/${values.projectId}`);
}

export async function deleteStoryTask(formData: FormData) {
  const values = z
    .object({
      projectId: z.string().min(1),
      taskId: z.string().min(1),
      storyTaskId: z.string().min(1),
    })
    .parse({
      projectId: formData.get("projectId"),
      taskId: formData.get("taskId"),
      storyTaskId: formData.get("storyTaskId"),
    });

  const { space, base } = await resolveFormSpace(formData);
  await run(deleteStoryTaskCore(values, space));

  revalidatePath(`${base}/projects/${values.projectId}`);
  redirect(`${base}/projects/${values.projectId}?task=${values.taskId}`);
}

const createTagSchema = z.object({
  name: z.string().trim().min(2).max(40),
  color: z.enum(TAG_COLOR_OPTIONS).optional(),
});

// Standalone tag creation (find-or-create by name) used by the tag picker's
// "new tag" flow. Returns the resolved tag so the client can select it.
export async function createTag(input: z.infer<typeof createTagSchema>, teamId?: string) {
  const values = createTagSchema.parse(input);
  const space = await getSpaceContext(teamId);
  const tagId = await resolveTagId({ tagName: values.name, tagColor: values.color }, space);
  if (!tagId) {
    throw new Error("Could not create tag");
  }
  const tag = await db.query.tags.findFirst({
    where: space.teamId
      ? and(eq(tags.id, tagId), eq(tags.teamId, space.teamId))
      : and(eq(tags.id, tagId), eq(tags.userId, space.uid)),
    columns: { id: true, name: true, color: true },
  });
  return tag!;
}

// Client-callable wrapper so the tag picker can load the workspace tag pool
// without threading the list through every mount point as props.
export async function getTagsAction(teamId?: string) {
  return getTags(teamId);
}

const deleteTagSchema = z.object({
  tagId: z.string().min(1),
});

// Used by the settings pages' "Tags" card. Detaches the tag from anything it
// was applied to (ON DELETE SET NULL) rather than deleting those items.
export async function deleteTag(formData: FormData) {
  const values = deleteTagSchema.parse({ tagId: formData.get("tagId") });
  const { space, base } = await resolveFormSpace(formData);
  await run(deleteTagCore(values.tagId, space));

  revalidatePath(`${base}/settings`);
}
