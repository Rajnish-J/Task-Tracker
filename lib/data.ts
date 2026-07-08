import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { getCurrentUserId } from "@/lib/auth-session";
import { db } from "@/lib/db";
import { columns, PRIORITY_VALUES, projects, sections, storyTasks, tasks } from "@/lib/db/schema";

type Priority = (typeof PRIORITY_VALUES)[number];

export type Tag = { id: string; name: string; color: string };

// All workspace tags, alphabetized for stable pickers and filters.
export async function getTags(): Promise<Tag[]> {
  const uid = await getCurrentUserId();
  return db.query.tags.findMany({
    where: (tags, { eq }) => eq(tags.userId, uid),
    orderBy: (tags) => [asc(tags.name)],
    columns: { id: true, name: true, color: true },
  });
}

export async function getProjects() {
  const uid = await getCurrentUserId();
  const rows = await db.query.projects.findMany({
    where: (projects, { eq }) => eq(projects.userId, uid),
    orderBy: (projects) => [
      asc(projects.position),
      desc(projects.updatedAt),
      desc(projects.createdAt),
    ],
    with: {
      columns: {
        columns: { id: true },
      },
      tasks: {
        columns: { id: true },
      },
    },
  });

  return rows.map(({ tasks, ...project }) => ({
    ...project,
    columns: project.columns,
    _count: { tasks: tasks.length },
  }));
}

export async function getProjectBoard(projectId: string) {
  const uid = await getCurrentUserId();
  const project = await db.query.projects.findFirst({
    where: (projects, { eq, and }) =>
      and(eq(projects.id, projectId), eq(projects.userId, uid)),
    with: {
      tag: true,
      columns: {
        orderBy: (columns) => [asc(columns.position)],
        with: {
          tasks: {
            orderBy: (tasks) => [asc(tasks.position), asc(tasks.createdAt)],
            with: {
              tag: true,
              storyTasks: {
                orderBy: (storyTasks) => [asc(storyTasks.position), asc(storyTasks.createdAt)],
                with: { tag: true },
              },
            },
          },
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  return project;
}

// Everything carrying a given tag — sections, projects, boards (cards) and tasks
// (checklist items) — each with the context needed to link back to it from the
// dashboard.
export async function getTaggedItems(tagId: string) {
  const uid = await getCurrentUserId();
  const [sectionRows, boards, items] = await Promise.all([
    db.query.sections.findMany({
      where: and(eq(sections.tagId, tagId), eq(sections.userId, uid)),
      orderBy: (sections) => [asc(sections.name)],
      columns: { id: true, name: true },
    }),
    db.query.tasks.findMany({
      where: eq(tasks.tagId, tagId),
      orderBy: (tasks) => [desc(tasks.updatedAt)],
      columns: { id: true, title: true, projectId: true },
      with: {
        tag: true,
        project: { columns: { id: true, name: true } },
        column: { columns: { name: true } },
      },
    }),
    db.query.storyTasks.findMany({
      where: eq(storyTasks.tagId, tagId),
      orderBy: (storyTasks) => [desc(storyTasks.updatedAt)],
      columns: { id: true, title: true, isDone: true, taskId: true },
      with: {
        tag: true,
        task: {
          columns: { id: true, title: true },
          with: { project: { columns: { id: true, name: true } } },
        },
      },
    }),
  ]);

  // Every project involved in this tag, so the list mirrors the filtered KPIs:
  // projects carrying the tag directly, projects inside a tagged section, and
  // projects that merely contain a tagged card or checklist item.
  const projectIdSet = await getProjectIdsMatchingTag(tagId, uid);
  for (const board of boards) {
    projectIdSet.add(board.projectId);
  }
  for (const item of items) {
    const projectId = item.task?.project?.id;
    if (projectId) projectIdSet.add(projectId);
  }

  const projectRows = projectIdSet.size
    ? await db.query.projects.findMany({
        where: and(inArray(projects.id, [...projectIdSet]), eq(projects.userId, uid)),
        orderBy: (projects) => [asc(projects.name)],
        columns: { id: true, name: true },
      })
    : [];

  return { sections: sectionRows, projects: projectRows, boards, items };
}

export type TaggedItems = Awaited<ReturnType<typeof getTaggedItems>>;

// Map a column name to a normalized status key. Column names are user-editable,
// so we match the default lane names case-insensitively and fall back to "other".
export function statusKeyFromColumnName(name: string): "todo" | "inProgress" | "review" | "done" | "other" {
  const normalized = name.trim().toLowerCase();
  if (normalized === "to do" || normalized === "todo" || normalized === "backlog") return "todo";
  if (normalized === "in progress" || normalized === "doing") return "inProgress";
  if (normalized === "review" || normalized === "in review") return "review";
  if (normalized === "done" || normalized === "completed") return "done";
  return "other";
}

// Tailwind classes used to color status chips/cells, keyed by normalized status.
export const STATUS_COLORS: Record<string, string> = {
  todo: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  inProgress: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  review: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  done: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  other: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
};

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;

// Projects whose every card should be counted for a tag filter: a project that
// carries the tag itself, or one that belongs to a section (or any ancestor
// section) carrying the tag. A tagged section covers its whole subtree.
async function getProjectIdsMatchingTag(tagId: string, uid: string): Promise<Set<string>> {
  const [sectionRows, projectRows] = await Promise.all([
    db.query.sections.findMany({
      where: (sections, { eq }) => eq(sections.userId, uid),
      columns: { id: true, parentId: true, tagId: true },
    }),
    db.query.projects.findMany({
      where: (projects, { eq }) => eq(projects.userId, uid),
      columns: { id: true, tagId: true, sectionId: true },
    }),
  ]);

  const childrenByParent = new Map<string, string[]>();
  for (const section of sectionRows) {
    if (!section.parentId) continue;
    const list = childrenByParent.get(section.parentId) ?? [];
    list.push(section.id);
    childrenByParent.set(section.parentId, list);
  }

  // Sections carrying the tag, plus every descendant section (visited guards a
  // malformed cycle).
  const matchedSectionIds = new Set<string>();
  const queue = sectionRows.filter((section) => section.tagId === tagId).map((section) => section.id);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (matchedSectionIds.has(current)) continue;
    matchedSectionIds.add(current);
    for (const child of childrenByParent.get(current) ?? []) {
      queue.push(child);
    }
  }

  const matchedProjectIds = new Set<string>();
  for (const project of projectRows) {
    if (project.tagId === tagId || (project.sectionId && matchedSectionIds.has(project.sectionId))) {
      matchedProjectIds.add(project.id);
    }
  }
  return matchedProjectIds;
}

export async function getDashboardData(tagId?: string) {
  const uid = await getCurrentUserId();
  const now = new Date();
  const soonThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const projects = await db.query.projects.findMany({
    where: (projects, { eq }) => eq(projects.userId, uid),
    orderBy: (projects) => [desc(projects.updatedAt), desc(projects.createdAt)],
    with: {
      columns: {
        orderBy: (columns) => [asc(columns.position)],
        with: {
          tasks: {
            with: { storyTasks: true },
          },
        },
      },
    },
  });

  // When a tag filter is active, narrow the data to anything carrying that tag.
  // A whole project's cards are kept when the project itself, or its section
  // (or any ancestor section), carries the tag; otherwise only the individual
  // cards carrying the tag — directly or via one of their checklist items — are
  // kept. Projects with no matching cards stay in the list, with zeros.
  let scopedProjects = projects;
  let matchedProjectIds: Set<string> | null = null;
  if (tagId) {
    const matched = await getProjectIdsMatchingTag(tagId, uid);
    matchedProjectIds = matched;

    scopedProjects = projects.map((project) => {
      if (matched.has(project.id)) {
        return project;
      }
      return {
        ...project,
        columns: project.columns.map((column) => ({
          ...column,
          tasks: column.tasks.filter(
            (task) =>
              task.tagId === tagId ||
              task.storyTasks.some((story) => story.tagId === tagId),
          ),
        })),
      };
    });
  }

  // A project is "involved" in the active tag when it carries the tag itself or
  // sits in a tagged section (matchedProjectIds), or when it has at least one
  // card kept by the narrowing above. Used to scope the Projects KPI/list so the
  // count reflects the filter instead of the whole workspace.
  const isInvolved = (projectId: string, keptTaskCount: number) =>
    !tagId || matchedProjectIds!.has(projectId) || keptTaskCount > 0;

  let totalTasks = 0;
  let todo = 0;
  let inProgress = 0;
  let review = 0;
  let done = 0;
  let overdue = 0;
  let dueSoon = 0;
  let totalStoryTasks = 0;
  let storyTasksDone = 0;

  const priorityCounts: Record<Priority, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    URGENT: 0,
  };

  // Aggregate status counts by column display name across all projects.
  const statusByName = new Map<string, { count: number; key: string }>();

  const projectRows = scopedProjects.map((project) => {
    let projectTasks = 0;
    let projectTodo = 0;
    let projectInProgress = 0;
    let projectDone = 0;
    let projectStoryTasks = 0;
    let projectStoryTasksDone = 0;

    for (const column of project.columns) {
      const key = statusKeyFromColumnName(column.name);
      const existing = statusByName.get(column.name) ?? { count: 0, key };
      existing.count += column.tasks.length;
      statusByName.set(column.name, existing);

      for (const task of column.tasks) {
        totalTasks += 1;
        projectTasks += 1;
        priorityCounts[task.priority as Priority] += 1;

        if (key === "todo") {
          todo += 1;
          projectTodo += 1;
        } else if (key === "inProgress") {
          inProgress += 1;
          projectInProgress += 1;
        } else if (key === "review") {
          review += 1;
        } else if (key === "done") {
          done += 1;
          projectDone += 1;
        }

        // Due-date metrics ignore tasks already in a "done" lane.
        if (task.dueDate && key !== "done") {
          if (task.dueDate < now) {
            overdue += 1;
          } else if (task.dueDate <= soonThreshold) {
            dueSoon += 1;
          }
        }

        // Aggregate the card's checklist items (storyTasks).
        for (const storyTask of task.storyTasks) {
          totalStoryTasks += 1;
          projectStoryTasks += 1;
          if (storyTask.isDone) {
            storyTasksDone += 1;
            projectStoryTasksDone += 1;
          }
        }
      }
    }

    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      columnCount: project.columns.length,
      taskCount: projectTasks,
      todo: projectTodo,
      inProgress: projectInProgress,
      done: projectDone,
      totalStoryTasks: projectStoryTasks,
      storyTasksDone: projectStoryTasksDone,
      updatedAt: project.updatedAt,
    };
  });

  // When a tag filter is active, keep only the projects actually involved in the
  // tag so the Projects count and per-project table match the rest of the view.
  const visibleProjectRows = projectRows.filter((project) =>
    isInvolved(project.id, project.taskCount),
  );

  const statusBreakdown = Array.from(statusByName.entries()).map(([name, { count, key }]) => ({
    name,
    count,
    color: STATUS_COLORS[key] ?? STATUS_COLORS.other,
  }));

  const priorityBreakdown = PRIORITY_VALUES.map((value) => ({
    priority: value,
    count: priorityCounts[value],
  }));

  return {
    totalProjects: visibleProjectRows.length,
    totalTasks,
    todo,
    inProgress,
    review,
    done,
    overdue,
    dueSoon,
    totalStoryTasks,
    storyTasksDone,
    statusBreakdown,
    priorityBreakdown,
    storyTaskBreakdown: [
      { name: "Done", count: storyTasksDone },
      { name: "Open", count: totalStoryTasks - storyTasksDone },
    ],
    projects: visibleProjectRows,
  };
}

// Full project/column/task/storyTask tree for the cross-project timeline view.
export async function getTimelineData() {
  const uid = await getCurrentUserId();
  return db.query.projects.findMany({
    where: (projects, { eq }) => eq(projects.userId, uid),
    orderBy: (projects) => [asc(projects.name)],
    with: {
      columns: {
        orderBy: (columns) => [asc(columns.position)],
        with: {
          tasks: {
            orderBy: (tasks) => [asc(tasks.createdAt)],
            with: {
              storyTasks: {
                orderBy: (storyTasks) => [asc(storyTasks.createdAt)],
              },
            },
          },
        },
      },
    },
  });
}

export type TimelineData = Awaited<ReturnType<typeof getTimelineData>>;

// ---------------------------------------------------------------------------
// Sections: nested groups of projects with an aggregated, read-only board.
// ---------------------------------------------------------------------------

export type SectionProject = {
  id: string;
  name: string;
  slug: string;
  taskCount: number;
  // Carried so the sidebar's edit dialog can prefill every field, not just the name.
  description: string | null;
  sectionId: string | null;
  tag: Tag | null;
};

export type SectionNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  position: number;
  // Carried so the sidebar's edit dialog can prefill every field.
  description: string | null;
  tag: Tag | null;
  projects: SectionProject[];
  children: SectionNode[];
  // Total tasks across this section's own projects plus every descendant's.
  taskCount: number;
};

// Sum a node's own project tasks plus all descendant tasks (mutates taskCount).
function rollupSectionTaskCounts(node: SectionNode): number {
  const ownTasks = node.projects.reduce((sum, project) => sum + project.taskCount, 0);
  const childTasks = node.children.reduce(
    (sum, child) => sum + rollupSectionTaskCounts(child),
    0,
  );
  node.taskCount = ownTasks + childTasks;
  return node.taskCount;
}

// Build the section tree plus the list of projects with no section. Recursion is
// done in JS over a flat fetch — simpler than a recursive CTE and plenty fast at
// this workspace's scale.
export async function getSectionsTree(): Promise<{
  tree: SectionNode[];
  ungroupedProjects: SectionProject[];
}> {
  const uid = await getCurrentUserId();
  const [sectionRows, projectRows] = await Promise.all([
    db.query.sections.findMany({
      where: (sections, { eq }) => eq(sections.userId, uid),
      orderBy: (sections) => [asc(sections.position), asc(sections.name)],
      columns: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        position: true,
        description: true,
      },
      with: { tag: true },
    }),
    db.query.projects.findMany({
      where: (projects, { eq }) => eq(projects.userId, uid),
      orderBy: (projects) => [
        asc(projects.position),
        desc(projects.updatedAt),
        desc(projects.createdAt),
      ],
      columns: { id: true, name: true, slug: true, sectionId: true, description: true },
      with: { tasks: { columns: { id: true } }, tag: true },
    }),
  ]);

  const nodes = new Map<string, SectionNode>();
  for (const section of sectionRows) {
    nodes.set(section.id, {
      id: section.id,
      name: section.name,
      slug: section.slug,
      parentId: section.parentId,
      position: section.position,
      description: section.description,
      tag: section.tag ?? null,
      projects: [],
      children: [],
      taskCount: 0,
    });
  }

  const ungroupedProjects: SectionProject[] = [];
  for (const project of projectRows) {
    const entry: SectionProject = {
      id: project.id,
      name: project.name,
      slug: project.slug,
      taskCount: project.tasks.length,
      description: project.description,
      sectionId: project.sectionId,
      tag: project.tag ?? null,
    };
    const node = project.sectionId ? nodes.get(project.sectionId) : undefined;
    if (node) {
      node.projects.push(entry);
    } else {
      ungroupedProjects.push(entry);
    }
  }

  const tree: SectionNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      tree.push(node);
    }
  }

  for (const root of tree) {
    rollupSectionTaskCounts(root);
  }

  return { tree, ungroupedProjects };
}

// Flatten the section tree into "Parent / Child" labels for parent/section
// pickers in dialogs.
export function flattenSectionTree(
  nodes: SectionNode[],
  prefix = "",
): { id: string; label: string }[] {
  return nodes.flatMap((node) => {
    const label = prefix ? `${prefix} / ${node.name}` : node.name;
    return [{ id: node.id, label }, ...flattenSectionTree(node.children, label)];
  });
}

// Collect the ids of every project belonging to a section or any of its
// descendant sections. Uses a visited set so a malformed cycle can't loop.
async function collectSubtreeProjectIds(sectionId: string, uid: string): Promise<string[]> {
  const sectionRows = await db.query.sections.findMany({
    where: (sections, { eq }) => eq(sections.userId, uid),
    columns: { id: true, parentId: true },
  });
  const childrenByParent = new Map<string, string[]>();
  for (const section of sectionRows) {
    if (!section.parentId) continue;
    const list = childrenByParent.get(section.parentId) ?? [];
    list.push(section.id);
    childrenByParent.set(section.parentId, list);
  }

  const sectionIds = new Set<string>();
  const queue = [sectionId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (sectionIds.has(current)) continue;
    sectionIds.add(current);
    for (const child of childrenByParent.get(current) ?? []) {
      queue.push(child);
    }
  }

  const projectRows = await db.query.projects.findMany({
    where: (projects, { eq }) => eq(projects.userId, uid),
    columns: { id: true, sectionId: true },
  });
  return projectRows
    .filter((project) => project.sectionId && sectionIds.has(project.sectionId))
    .map((project) => project.id);
}

// Ordered lane keys + labels for the aggregated section board.
const SECTION_LANES: { key: string; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "inProgress", label: "In Progress" },
  { key: "done", label: "Done" },
];

export type SectionBoardCard = {
  id: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  notes: string | null;
  priority: Priority;
  dueDate: Date | null;
  projectId: string;
  projectName: string;
  position: number;
  createdAt: Date;
  tag: Tag | null;
  storyTasks: {
    id: string;
    title: string;
    priority: Priority;
    isDone: boolean;
    tag: Tag | null;
  }[];
};

export type SectionBoardLane = {
  key: string;
  label: string;
  color: string;
  tasks: SectionBoardCard[];
};

// The aggregated, read-only board for a section: every card from every project
// in the section's subtree, bucketed into normalized status lanes (columns are
// per-project and user-editable, so we merge by status key, mirroring the
// dashboard's approach).
export async function getSectionBoard(sectionId: string) {
  const uid = await getCurrentUserId();
  const section = await db.query.sections.findFirst({
    where: (sections, { eq, and }) =>
      and(eq(sections.id, sectionId), eq(sections.userId, uid)),
    columns: { id: true, name: true, slug: true, description: true, updatedAt: true },
  });

  if (!section) {
    notFound();
  }

  const projectIds = await collectSubtreeProjectIds(sectionId, uid);

  const lanes: SectionBoardLane[] = SECTION_LANES.map((lane) => ({
    ...lane,
    color: STATUS_COLORS[lane.key] ?? STATUS_COLORS.other,
    tasks: [],
  }));
  const laneByKey = new Map(lanes.map((lane) => [lane.key, lane]));

  // Guard against inArray on an empty list — return empty lanes instead.
  if (projectIds.length === 0) {
    return { section, lanes };
  }

  const rows = await db.query.tasks.findMany({
    where: inArray(tasks.projectId, projectIds),
    with: {
      tag: true,
      project: { columns: { name: true } },
      column: { columns: { name: true } },
      storyTasks: {
        orderBy: (storyTasks) => [asc(storyTasks.position), asc(storyTasks.createdAt)],
        with: { tag: true },
      },
    },
  });

  for (const row of rows) {
    // The section board only surfaces todo/inProgress/done lanes, so collapse
    // the two removed keys onto surviving lanes: review folds into In Progress,
    // and anything unrecognized ("other") defaults to To Do.
    const rawKey = statusKeyFromColumnName(row.column.name);
    const key = rawKey === "review" ? "inProgress" : rawKey === "other" ? "todo" : rawKey;
    const lane = laneByKey.get(key) ?? laneByKey.get("todo")!;
    lane.tasks.push({
      id: row.id,
      title: row.title,
      shortDescription: row.shortDescription,
      description: row.description,
      notes: row.notes,
      priority: row.priority as Priority,
      dueDate: row.dueDate,
      projectId: row.projectId,
      projectName: row.project.name,
      position: row.position,
      createdAt: row.createdAt,
      tag: row.tag ?? null,
      storyTasks: row.storyTasks.map((story) => ({
        id: story.id,
        title: story.title,
        priority: story.priority as Priority,
        isDone: story.isDone,
        tag: story.tag ?? null,
      })),
    });
  }

  // Deterministic order within a lane: group by project name, then position.
  for (const lane of lanes) {
    lane.tasks.sort(
      (a, b) =>
        a.projectName.localeCompare(b.projectName) ||
        a.position - b.position ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }

  return { section, lanes };
}

export type SectionBoard = Awaited<ReturnType<typeof getSectionBoard>>;

// Fetch a single task with the full shape the TaskDetailsSheet needs, plus its
// own project's columns — used when opening a card from an aggregated section
// board so edits route through the existing per-project task actions.
export async function getTaskForSheet(taskId: string) {
  const uid = await getCurrentUserId();
  const task = await db.query.tasks.findFirst({
    where: (tasks, { eq }) => eq(tasks.id, taskId),
    with: {
      tag: true,
      project: { columns: { userId: true } },
      storyTasks: {
        orderBy: (storyTasks) => [asc(storyTasks.position), asc(storyTasks.createdAt)],
        with: { tag: true },
      },
    },
  });

  // Not found, or the card belongs to another user's project.
  if (!task || task.project?.userId !== uid) {
    return null;
  }

  const projectColumns = await db.query.columns.findMany({
    where: eq(columns.projectId, task.projectId),
    orderBy: (columns) => [asc(columns.position)],
    columns: { id: true, name: true },
  });

  return { projectId: task.projectId, task, columns: projectColumns };
}
