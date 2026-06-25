import { notFound } from "next/navigation";
import { asc, desc } from "drizzle-orm";

import { db } from "@/lib/db";
import { PRIORITY_VALUES } from "@/lib/db/schema";

type Priority = (typeof PRIORITY_VALUES)[number];

export async function getProjects() {
  const rows = await db.query.projects.findMany({
    orderBy: (projects) => [desc(projects.updatedAt), desc(projects.createdAt)],
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
  const project = await db.query.projects.findFirst({
    where: (projects, { eq }) => eq(projects.id, projectId),
    with: {
      columns: {
        orderBy: (columns) => [asc(columns.position)],
        with: {
          tasks: {
            orderBy: (tasks) => [asc(tasks.position), asc(tasks.createdAt)],
            with: {
              storyTasks: {
                orderBy: (storyTasks) => [asc(storyTasks.position), asc(storyTasks.createdAt)],
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

export async function getDashboardData() {
  const now = new Date();
  const soonThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const projects = await db.query.projects.findMany({
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

  const projectRows = projects.map((project) => {
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
    totalProjects: projects.length,
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
    projects: projectRows,
  };
}

// Full project/column/task/storyTask tree for the cross-project timeline view.
export async function getTimelineData() {
  return db.query.projects.findMany({
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
