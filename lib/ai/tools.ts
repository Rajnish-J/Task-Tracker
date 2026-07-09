import type Anthropic from "@anthropic-ai/sdk";
import { asc } from "drizzle-orm";
import { z } from "zod";

import { COLUMN_ACCENT_META, COLUMN_COLOR_OPTIONS } from "@/lib/constants";
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
  deleteTaskCore,
  moveTaskCore,
  MutationError,
  personalSpace,
  toggleStoryTaskCore,
  updateColumnCore,
  updateProjectCore,
  updateSectionCore,
  updateStoryTaskCore,
  updateTaskCore,
} from "@/lib/db/mutations";
import { PRIORITY_VALUES } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// Chat assistant tools. Definitions are plain Anthropic tool schemas with
// prescriptive when-to-call descriptions; execution funnels into the shared
// mutation core (lib/db/mutations.ts) so the assistant hits exactly the same
// validation, ownership checks and position bookkeeping as the app's own UI.
// ---------------------------------------------------------------------------

// Friendly color names the model can use for columns, mapped to the Tailwind
// accent classes the app stores.
const COLOR_LABELS = COLUMN_COLOR_OPTIONS.map(
  (value) => COLUMN_ACCENT_META[value]?.label ?? value,
);
const COLOR_CLASS_BY_LABEL = new Map(
  COLUMN_COLOR_OPTIONS.map((value) => [COLUMN_ACCENT_META[value]?.label ?? value, value]),
);

const id = (description: string) => ({ type: "string" as const, description });

export const CHAT_TOOLS: Anthropic.Tool[] = [
  // -- Read tools -----------------------------------------------------------
  {
    name: "list_sections",
    description:
      "List all of the user's sections (folders that group projects) with their ids, names and parent sections. Call this when the user mentions a section that is not in the workspace snapshot, or before creating/moving sections.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_projects",
    description:
      "List all of the user's projects (kanban boards) with their ids, names, sections and status columns. Call this when the user mentions a project or column that is not in the workspace snapshot.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_project_board",
    description:
      "Get the full board for one project: its columns and every task (card) with id, title, priority, due date and checklist progress. Call this before updating, moving or deleting tasks so you have real task ids, or when the user asks what is on a board.",
    input_schema: {
      type: "object",
      properties: { projectId: id("Project id from the snapshot or list_projects") },
      required: ["projectId"],
      additionalProperties: false,
    },
  },
  {
    name: "get_task",
    description:
      "Get one task's full details including its checklist items (story tasks) with their ids and done state. Call this before updating or toggling checklist items.",
    input_schema: {
      type: "object",
      properties: {
        projectId: id("Project id the task belongs to"),
        taskId: id("Task id from get_project_board"),
      },
      required: ["projectId", "taskId"],
      additionalProperties: false,
    },
  },
  // -- Sections -------------------------------------------------------------
  {
    name: "create_section",
    description:
      "Create a new section (a folder that groups projects). Call when the user asks for a new section, group or folder.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Section name (2-80 chars)" },
        description: { type: "string", description: "Optional description (max 240 chars)" },
        parentSectionId: id("Optional parent section id to nest under"),
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "update_section",
    description:
      "Rename a section, change its description, or move it under another parent section. Only pass the fields you want to change.",
    input_schema: {
      type: "object",
      properties: {
        sectionId: id("Section id to update"),
        name: { type: "string", description: "New name (2-80 chars)" },
        description: { type: "string", description: "New description (max 240 chars)" },
        parentSectionId: {
          type: ["string", "null"],
          description: "New parent section id, or null to move to the top level",
        },
      },
      required: ["sectionId"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_section",
    description:
      "Delete a section. Its child sections are promoted to the top level and its projects are ungrouped — no boards or tasks are lost. Confirm with the user before calling unless they clearly already confirmed.",
    input_schema: {
      type: "object",
      properties: { sectionId: id("Section id to delete") },
      required: ["sectionId"],
      additionalProperties: false,
    },
  },
  // -- Projects -------------------------------------------------------------
  {
    name: "create_project",
    description:
      'Create a new project (kanban board). It starts with the default "To Do", "In Progress" and "Done" columns. Call when the user asks for a new project or board.',
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Project name (2-80 chars)" },
        description: { type: "string", description: "Optional description (max 240 chars)" },
        sectionId: id("Optional section id to place the project in"),
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "update_project",
    description:
      "Rename a project, change its description, or move it into/out of a section. Only pass the fields you want to change.",
    input_schema: {
      type: "object",
      properties: {
        projectId: id("Project id to update"),
        name: { type: "string", description: "New name (2-80 chars)" },
        description: { type: "string", description: "New description (max 240 chars)" },
        sectionId: {
          type: ["string", "null"],
          description: "Section id to move the project into, or null to ungroup it",
        },
      },
      required: ["projectId"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_project",
    description:
      "Delete a project and its ENTIRE board — all columns, tasks and checklist items are permanently removed. Always confirm with the user before calling unless they clearly already confirmed.",
    input_schema: {
      type: "object",
      properties: { projectId: id("Project id to delete") },
      required: ["projectId"],
      additionalProperties: false,
    },
  },
  // -- Columns (status lanes) -----------------------------------------------
  {
    name: "create_column",
    description:
      'Add a new status column (lane) to a project board. The column name IS the status label (e.g. "Review", "Blocked"). The new column is appended after the existing ones.',
    input_schema: {
      type: "object",
      properties: {
        projectId: id("Project id to add the column to"),
        name: { type: "string", description: "Column/status name (2-40 chars)" },
        color: {
          type: "string",
          enum: COLOR_LABELS,
          description: "Optional accent color for the column header",
        },
      },
      required: ["projectId", "name"],
      additionalProperties: false,
    },
  },
  {
    name: "update_column",
    description:
      "Rename a status column or change its accent color. Only pass the fields you want to change.",
    input_schema: {
      type: "object",
      properties: {
        projectId: id("Project id the column belongs to"),
        columnId: id("Column id to update"),
        name: { type: "string", description: "New column/status name (2-40 chars)" },
        color: { type: "string", enum: COLOR_LABELS, description: "New accent color" },
      },
      required: ["projectId", "columnId"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_column",
    description:
      "Delete a status column. Its tasks are moved to another lane automatically. Fails if it is the project's only column.",
    input_schema: {
      type: "object",
      properties: {
        projectId: id("Project id the column belongs to"),
        columnId: id("Column id to delete"),
      },
      required: ["projectId", "columnId"],
      additionalProperties: false,
    },
  },
  // -- Tasks (cards) ----------------------------------------------------------
  {
    name: "create_task",
    description:
      "Create a new task (card) in a specific column of a project. Pick the column whose name matches the requested status; if the user did not say, use the To Do column.",
    input_schema: {
      type: "object",
      properties: {
        projectId: id("Project id"),
        columnId: id("Column id the task starts in"),
        title: { type: "string", description: "Task title (2-120 chars)" },
        shortDescription: { type: "string", description: "Optional one-liner (max 160 chars)" },
        description: { type: "string", description: "Optional details (max 600 chars)" },
        notes: { type: "string", description: "Optional notes (max 1200 chars)" },
        priority: {
          type: "string",
          enum: [...PRIORITY_VALUES],
          description: "Priority, defaults to MEDIUM",
        },
        dueDate: { type: "string", description: "Optional due date as YYYY-MM-DD" },
      },
      required: ["projectId", "columnId", "title"],
      additionalProperties: false,
    },
  },
  {
    name: "update_task",
    description:
      "Edit a task's title, descriptions, notes, priority or due date. Only pass the fields you want to change. To change a task's status/column, use move_task instead.",
    input_schema: {
      type: "object",
      properties: {
        projectId: id("Project id the task belongs to"),
        taskId: id("Task id to update"),
        title: { type: "string", description: "New title (2-120 chars)" },
        shortDescription: {
          type: ["string", "null"],
          description: "New one-liner (max 160 chars), or null to clear",
        },
        description: {
          type: ["string", "null"],
          description: "New details (max 600 chars), or null to clear",
        },
        notes: {
          type: ["string", "null"],
          description: "New notes (max 1200 chars), or null to clear",
        },
        priority: { type: "string", enum: [...PRIORITY_VALUES] },
        dueDate: {
          type: ["string", "null"],
          description: "New due date as YYYY-MM-DD, or null to clear",
        },
      },
      required: ["projectId", "taskId"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_task",
    description: "Delete a task (card) and its checklist items permanently.",
    input_schema: {
      type: "object",
      properties: {
        projectId: id("Project id the task belongs to"),
        taskId: id("Task id to delete"),
      },
      required: ["projectId", "taskId"],
      additionalProperties: false,
    },
  },
  {
    name: "move_task",
    description:
      'Move a task to another column — THIS is how you change a task\'s status (e.g. "To Do" → "In Progress" → "Done") or reorder it within a lane. Use the destination column id from the snapshot or get_project_board.',
    input_schema: {
      type: "object",
      properties: {
        projectId: id("Project id the task belongs to"),
        taskId: id("Task id to move"),
        toColumnId: id("Destination column id (its name is the new status)"),
        toIndex: {
          type: "integer",
          minimum: 0,
          description: "Optional position within the destination column; omit to append at the end",
        },
      },
      required: ["projectId", "taskId", "toColumnId"],
      additionalProperties: false,
    },
  },
  // -- Story tasks (checklist items) -----------------------------------------
  {
    name: "create_story_task",
    description:
      "Add a checklist item (story task) to a task. When every checklist item on a task is done, the app auto-moves the task to Done.",
    input_schema: {
      type: "object",
      properties: {
        projectId: id("Project id"),
        taskId: id("Task id to add the checklist item to"),
        title: { type: "string", description: "Checklist item title (2-120 chars)" },
        description: { type: "string", description: "Optional details (max 600 chars)" },
        priority: { type: "string", enum: [...PRIORITY_VALUES], description: "Defaults to MEDIUM" },
        dueDate: { type: "string", description: "Optional due date as YYYY-MM-DD" },
      },
      required: ["projectId", "taskId", "title"],
      additionalProperties: false,
    },
  },
  {
    name: "update_story_task",
    description:
      "Edit a checklist item's title, description, priority or due date. Only pass the fields you want to change. To check/uncheck it, use toggle_story_task.",
    input_schema: {
      type: "object",
      properties: {
        projectId: id("Project id"),
        taskId: id("Parent task id"),
        storyTaskId: id("Checklist item id from get_task"),
        title: { type: "string", description: "New title (2-120 chars)" },
        description: {
          type: ["string", "null"],
          description: "New details (max 600 chars), or null to clear",
        },
        priority: { type: "string", enum: [...PRIORITY_VALUES] },
        dueDate: {
          type: ["string", "null"],
          description: "New due date as YYYY-MM-DD, or null to clear",
        },
      },
      required: ["projectId", "taskId", "storyTaskId"],
      additionalProperties: false,
    },
  },
  {
    name: "toggle_story_task",
    description:
      "Mark a checklist item as done or not done. Completing the last open item auto-moves the parent task to the Done lane; reopening an item can move it back out.",
    input_schema: {
      type: "object",
      properties: {
        projectId: id("Project id"),
        taskId: id("Parent task id"),
        storyTaskId: id("Checklist item id"),
        isDone: { type: "boolean", description: "true = done, false = not done" },
      },
      required: ["projectId", "taskId", "storyTaskId", "isDone"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_story_task",
    description: "Delete a checklist item from a task permanently.",
    input_schema: {
      type: "object",
      properties: {
        projectId: id("Project id"),
        taskId: id("Parent task id"),
        storyTaskId: id("Checklist item id to delete"),
      },
      required: ["projectId", "taskId", "storyTaskId"],
      additionalProperties: false,
    },
  },
];

export type ToolResult = { content: string; isError?: boolean };

const ok = (payload: unknown): ToolResult => ({ content: JSON.stringify(payload) });
const fail = (message: string): ToolResult => ({ content: message, isError: true });

const toDateString = (value: Date | null) =>
  value ? value.toISOString().slice(0, 10) : undefined;

// Loose schema for read-merge tools: string | null | undefined.
const optText = z.string().nullish();

function colorClassFromLabel(label?: string) {
  if (!label) return undefined;
  return COLOR_CLASS_BY_LABEL.get(label) ?? undefined;
}

// Execute one tool call on behalf of `uid`. All ownership re-asserts happen in
// the mutation core using the session uid — a wrong or foreign id from the
// model surfaces as an is_error result, never as another user's data.
export async function executeTool(
  name: string,
  rawInput: unknown,
  uid: string,
): Promise<ToolResult> {
  const input = (rawInput ?? {}) as Record<string, unknown>;
  // The chat assistant operates on the user's personal space only — team
  // boards are not exposed to it (an explicit non-goal for now).
  const space = personalSpace(uid);
  try {
    switch (name) {
      case "list_sections": {
        const rows = await db.query.sections.findMany({
          where: (sections, { eq }) => eq(sections.userId, uid),
          orderBy: (sections) => [asc(sections.position), asc(sections.name)],
          columns: { id: true, name: true, parentId: true, description: true },
        });
        return ok({ sections: rows });
      }
      case "list_projects": {
        const rows = await db.query.projects.findMany({
          where: (projects, { eq }) => eq(projects.userId, uid),
          orderBy: (projects) => [asc(projects.position), asc(projects.name)],
          columns: { id: true, name: true, sectionId: true, description: true },
          with: {
            columns: {
              orderBy: (columns) => [asc(columns.position)],
              columns: { id: true, name: true, position: true },
            },
          },
        });
        return ok({ projects: rows });
      }
      case "get_project_board": {
        const projectId = z.string().min(1).parse(input.projectId);
        const project = await db.query.projects.findFirst({
          where: (projects, { eq, and }) =>
            and(eq(projects.id, projectId), eq(projects.userId, uid)),
          columns: { id: true, name: true, description: true },
          with: {
            columns: {
              orderBy: (columns) => [asc(columns.position)],
              columns: { id: true, name: true, position: true },
              with: {
                tasks: {
                  orderBy: (tasks) => [asc(tasks.position)],
                  columns: {
                    id: true,
                    title: true,
                    shortDescription: true,
                    priority: true,
                    dueDate: true,
                    position: true,
                  },
                  with: { storyTasks: { columns: { isDone: true } } },
                },
              },
            },
          },
        });
        if (!project) return fail(`Project ${projectId} not found`);
        return ok({
          id: project.id,
          name: project.name,
          description: project.description,
          columns: project.columns.map((column) => ({
            id: column.id,
            name: column.name,
            position: column.position,
            tasks: column.tasks.map((task) => ({
              id: task.id,
              title: task.title,
              shortDescription: task.shortDescription ?? undefined,
              priority: task.priority,
              dueDate: toDateString(task.dueDate),
              position: task.position,
              checklist: {
                done: task.storyTasks.filter((item) => item.isDone).length,
                total: task.storyTasks.length,
              },
            })),
          })),
        });
      }
      case "get_task": {
        const projectId = z.string().min(1).parse(input.projectId);
        const taskId = z.string().min(1).parse(input.taskId);
        const owned = await db.query.projects.findFirst({
          where: (projects, { eq, and }) =>
            and(eq(projects.id, projectId), eq(projects.userId, uid)),
          columns: { id: true },
        });
        if (!owned) return fail(`Project ${projectId} not found`);
        const task = await db.query.tasks.findFirst({
          where: (tasks, { eq, and }) =>
            and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)),
          with: {
            column: { columns: { id: true, name: true } },
            storyTasks: {
              orderBy: (storyTasks) => [asc(storyTasks.position)],
              columns: {
                id: true,
                title: true,
                description: true,
                priority: true,
                dueDate: true,
                isDone: true,
              },
            },
          },
        });
        if (!task) return fail(`Task ${taskId} not found in project ${projectId}`);
        return ok({
          id: task.id,
          title: task.title,
          shortDescription: task.shortDescription ?? undefined,
          description: task.description ?? undefined,
          notes: task.notes ?? undefined,
          priority: task.priority,
          dueDate: toDateString(task.dueDate),
          column: task.column,
          checklist: task.storyTasks.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description ?? undefined,
            priority: item.priority,
            dueDate: toDateString(item.dueDate),
            isDone: item.isDone,
          })),
        });
      }
      // -- Sections ---------------------------------------------------------
      case "create_section": {
        const created = await createSectionCore(
          {
            name: z.string().parse(input.name),
            description: optText.parse(input.description) ?? undefined,
            parentId: optText.parse(input.parentSectionId) ?? undefined,
          },
          space,
        );
        return ok({ ok: true, sectionId: created.id });
      }
      case "update_section": {
        const sectionId = z.string().min(1).parse(input.sectionId);
        const current = await db.query.sections.findFirst({
          where: (sections, { eq, and }) =>
            and(eq(sections.id, sectionId), eq(sections.userId, uid)),
          columns: { name: true, description: true, parentId: true, tagId: true },
        });
        if (!current) return fail(`Section ${sectionId} not found`);
        await updateSectionCore(
          {
            sectionId,
            name: optText.parse(input.name) ?? current.name,
            description:
              input.description === undefined
                ? current.description ?? undefined
                : optText.parse(input.description) ?? undefined,
            parentId:
              input.parentSectionId === undefined
                ? current.parentId ?? undefined
                : optText.parse(input.parentSectionId) ?? undefined,
            tagId: current.tagId ?? undefined,
          },
          space,
        );
        return ok({ ok: true, sectionId });
      }
      case "delete_section": {
        const sectionId = z.string().min(1).parse(input.sectionId);
        await deleteSectionCore(sectionId, space);
        return ok({ ok: true, deleted: sectionId });
      }
      // -- Projects ---------------------------------------------------------
      case "create_project": {
        const created = await createProjectCore(
          {
            name: z.string().parse(input.name),
            description: optText.parse(input.description) ?? undefined,
            sectionId: optText.parse(input.sectionId) ?? undefined,
          },
          space,
        );
        return ok({
          ok: true,
          projectId: created.id,
          note: 'Created with default columns "To Do", "In Progress", "Done"',
        });
      }
      case "update_project": {
        const projectId = z.string().min(1).parse(input.projectId);
        const current = await db.query.projects.findFirst({
          where: (projects, { eq, and }) =>
            and(eq(projects.id, projectId), eq(projects.userId, uid)),
          columns: { name: true, description: true, sectionId: true, tagId: true },
        });
        if (!current) return fail(`Project ${projectId} not found`);
        await updateProjectCore(
          {
            projectId,
            name: optText.parse(input.name) ?? current.name,
            description:
              input.description === undefined
                ? current.description ?? undefined
                : optText.parse(input.description) ?? undefined,
            sectionId:
              input.sectionId === undefined
                ? current.sectionId ?? undefined
                : optText.parse(input.sectionId) ?? undefined,
            tagId: current.tagId ?? undefined,
          },
          space,
        );
        return ok({ ok: true, projectId });
      }
      case "delete_project": {
        const projectId = z.string().min(1).parse(input.projectId);
        await deleteProjectCore(projectId, space);
        return ok({ ok: true, deleted: projectId });
      }
      // -- Columns ------------------------------------------------------------
      case "create_column": {
        const created = await createColumnCore(
          {
            projectId: z.string().parse(input.projectId),
            name: z.string().parse(input.name),
            color: colorClassFromLabel(optText.parse(input.color) ?? undefined) as never,
          },
          space,
        );
        return ok({ ok: true, columnId: created.id });
      }
      case "update_column": {
        const projectId = z.string().min(1).parse(input.projectId);
        const columnId = z.string().min(1).parse(input.columnId);
        const current = await db.query.columns.findFirst({
          where: (columns, { eq, and }) =>
            and(eq(columns.id, columnId), eq(columns.projectId, projectId)),
          columns: { name: true, color: true },
        });
        if (!current) return fail(`Column ${columnId} not found in project ${projectId}`);
        await updateColumnCore(
          {
            projectId,
            columnId,
            name: optText.parse(input.name) ?? current.name,
            color: (colorClassFromLabel(optText.parse(input.color) ?? undefined) ??
              current.color ??
              COLUMN_COLOR_OPTIONS[0]) as never,
          },
          space,
        );
        return ok({ ok: true, columnId });
      }
      case "delete_column": {
        await deleteColumnCore(
          {
            projectId: z.string().min(1).parse(input.projectId),
            columnId: z.string().min(1).parse(input.columnId),
          },
          space,
        );
        return ok({ ok: true });
      }
      // -- Tasks --------------------------------------------------------------
      case "create_task": {
        const created = await createTaskCore(
          {
            projectId: z.string().parse(input.projectId),
            columnId: z.string().parse(input.columnId),
            title: z.string().parse(input.title),
            shortDescription: optText.parse(input.shortDescription) ?? undefined,
            description: optText.parse(input.description) ?? undefined,
            notes: optText.parse(input.notes) ?? undefined,
            priority: (optText.parse(input.priority) ?? "MEDIUM") as never,
            dueDate: optText.parse(input.dueDate) ?? undefined,
          },
          space,
        );
        return ok({ ok: true, taskId: created.id });
      }
      case "update_task": {
        const projectId = z.string().min(1).parse(input.projectId);
        const taskId = z.string().min(1).parse(input.taskId);
        const owned = await db.query.projects.findFirst({
          where: (projects, { eq, and }) =>
            and(eq(projects.id, projectId), eq(projects.userId, uid)),
          columns: { id: true },
        });
        if (!owned) return fail(`Project ${projectId} not found`);
        const current = await db.query.tasks.findFirst({
          where: (tasks, { eq, and }) =>
            and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)),
        });
        if (!current) return fail(`Task ${taskId} not found in project ${projectId}`);
        await updateTaskCore(
          {
            projectId,
            taskId,
            title: optText.parse(input.title) ?? current.title,
            shortDescription:
              input.shortDescription === undefined
                ? current.shortDescription ?? undefined
                : optText.parse(input.shortDescription) ?? undefined,
            description:
              input.description === undefined
                ? current.description ?? undefined
                : optText.parse(input.description) ?? undefined,
            notes:
              input.notes === undefined
                ? current.notes ?? undefined
                : optText.parse(input.notes) ?? undefined,
            priority: (optText.parse(input.priority) ?? current.priority) as never,
            columnId: current.columnId,
            dueDate:
              input.dueDate === undefined
                ? toDateString(current.dueDate)
                : optText.parse(input.dueDate) ?? undefined,
            tagId: current.tagId ?? undefined,
          },
          space,
        );
        return ok({ ok: true, taskId });
      }
      case "delete_task": {
        await deleteTaskCore(
          {
            projectId: z.string().min(1).parse(input.projectId),
            taskId: z.string().min(1).parse(input.taskId),
          },
          space,
        );
        return ok({ ok: true });
      }
      case "move_task": {
        const projectId = z.string().min(1).parse(input.projectId);
        const taskId = z.string().min(1).parse(input.taskId);
        const toColumnId = z.string().min(1).parse(input.toColumnId);
        let toIndex = z.number().int().min(0).optional().parse(input.toIndex);
        if (toIndex === undefined) {
          const targetTasks = await db.query.tasks.findMany({
            where: (tasks, { eq }) => eq(tasks.columnId, toColumnId),
            columns: { id: true },
          });
          toIndex = targetTasks.length;
        }
        await moveTaskCore({ projectId, taskId, toColumnId, toIndex }, space);
        return ok({ ok: true, taskId, movedToColumnId: toColumnId });
      }
      // -- Story tasks ----------------------------------------------------------
      case "create_story_task": {
        const created = await createStoryTaskCore(
          {
            projectId: z.string().parse(input.projectId),
            taskId: z.string().parse(input.taskId),
            title: z.string().parse(input.title),
            description: optText.parse(input.description) ?? undefined,
            priority: (optText.parse(input.priority) ?? "MEDIUM") as never,
            dueDate: optText.parse(input.dueDate) ?? undefined,
          },
          space,
        );
        return ok({ ok: true, storyTaskId: created.id });
      }
      case "update_story_task": {
        const projectId = z.string().min(1).parse(input.projectId);
        const taskId = z.string().min(1).parse(input.taskId);
        const storyTaskId = z.string().min(1).parse(input.storyTaskId);
        const current = await db.query.storyTasks.findFirst({
          where: (storyTasks, { eq, and }) =>
            and(eq(storyTasks.id, storyTaskId), eq(storyTasks.taskId, taskId)),
        });
        if (!current) return fail(`Checklist item ${storyTaskId} not found`);
        await updateStoryTaskCore(
          {
            projectId,
            taskId,
            storyTaskId,
            title: optText.parse(input.title) ?? current.title,
            description:
              input.description === undefined
                ? current.description ?? undefined
                : optText.parse(input.description) ?? undefined,
            priority: (optText.parse(input.priority) ?? current.priority) as never,
            dueDate:
              input.dueDate === undefined
                ? toDateString(current.dueDate)
                : optText.parse(input.dueDate) ?? undefined,
            tagId: current.tagId ?? undefined,
          },
          space,
        );
        return ok({ ok: true, storyTaskId });
      }
      case "toggle_story_task": {
        await toggleStoryTaskCore(
          {
            projectId: z.string().min(1).parse(input.projectId),
            taskId: z.string().min(1).parse(input.taskId),
            storyTaskId: z.string().min(1).parse(input.storyTaskId),
            isDone: z.boolean().parse(input.isDone),
          },
          space,
        );
        return ok({ ok: true });
      }
      case "delete_story_task": {
        await deleteStoryTaskCore(
          {
            projectId: z.string().min(1).parse(input.projectId),
            taskId: z.string().min(1).parse(input.taskId),
            storyTaskId: z.string().min(1).parse(input.storyTaskId),
          },
          space,
        );
        return ok({ ok: true });
      }
      default:
        return fail(`Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof MutationError) {
      return fail(error.message);
    }
    if (error instanceof z.ZodError) {
      return fail(
        `Invalid input: ${error.issues
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
          .join("; ")}`,
      );
    }
    console.error(`Chat tool ${name} failed:`, error);
    return fail("The operation failed unexpectedly. Please try again.");
  }
}
