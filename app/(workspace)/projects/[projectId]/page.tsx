import { format } from "date-fns";

import { CreateColumnDialog } from "@/components/create-column-dialog";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { KanbanBoard } from "@/components/kanban-board";
import { ManageColumnsDialog } from "@/components/manage-columns-dialog";
import { TaskDetailsSheet } from "@/components/task-details-sheet";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getProjectBoard } from "@/lib/data";

export const dynamic = "force-dynamic";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ task?: string }>;
};

export default async function ProjectPage({
  params,
  searchParams,
}: ProjectPageProps) {
  const { projectId } = await params;
  const { task: taskId } = await searchParams;
  const project = await getProjectBoard(projectId);

  const selectedTask = taskId
    ? project.columns.flatMap((column) => column.tasks).find((task) => task.id === taskId) ?? null
    : null;

  return (
    <div className="flex h-full flex-1 flex-col">
      <header className="border-b border-border/60 bg-background/80 px-4 py-4 backdrop-blur md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <SidebarTrigger className="-ml-1 text-foreground" />
              <span>Projects</span>
              <span>/</span>
              <span className="text-foreground">{project.name}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              <Badge variant="secondary">{project.columns.length} columns</Badge>
              <Badge variant="secondary">
                {project.columns.reduce((count, column) => count + column.tasks.length, 0)} tasks
              </Badge>
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              {project.description?.trim() ||
                `Board updated ${format(project.updatedAt, "MMM d, yyyy")} with project-specific workflows and task details.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ManageColumnsDialog project={project} />
            <CreateColumnDialog projectId={project.id} />
            <CreateTaskDialog
              projectId={project.id}
              columns={project.columns.map((column) => ({ id: column.id, name: column.name }))}
            />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <KanbanBoard project={project} />
      </div>

      <TaskDetailsSheet
        projectId={project.id}
        task={selectedTask}
        columns={project.columns.map((column) => ({ id: column.id, name: column.name }))}
      />
    </div>
  );
}
import { format } from "date-fns";

import { CreateColumnDialog } from "@/components/create-column-dialog";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { KanbanBoard } from "@/components/kanban-board";
import { ManageColumnsDialog } from "@/components/manage-columns-dialog";
import { TaskDetailsSheet } from "@/components/task-details-sheet";
import { Badge } from "@/components/ui/badge";
import { getProjectBoard } from "@/lib/data";

export const dynamic = "force-dynamic";

type ProjectPageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ task?: string }>;
};

export default async function ProjectPage({
  params,
  searchParams,
}: ProjectPageProps) {
  const { projectId } = await params;
  const { task: taskId } = await searchParams;
  const project = await getProjectBoard(projectId);

  const selectedTask = taskId
    ? project.columns.flatMap((column) => column.tasks).find((task) => task.id === taskId) ?? null
    : null;

  return (
    <div className="flex h-full flex-1 flex-col">
      <header className="border-b border-border/60 bg-background/80 px-4 py-4 backdrop-blur md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Projects</span>
              <span>/</span>
              <span className="text-foreground">{project.name}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              <Badge variant="secondary">{project.columns.length} columns</Badge>
              <Badge variant="secondary">
                {project.columns.reduce((count, column) => count + column.tasks.length, 0)} tasks
              </Badge>
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              {project.description?.trim() ||
                `Board updated ${format(project.updatedAt, "MMM d, yyyy")} with project-specific workflows and task details.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ManageColumnsDialog project={project} />
            <CreateColumnDialog projectId={project.id} />
            <CreateTaskDialog
              projectId={project.id}
              columns={project.columns.map((column) => ({ id: column.id, name: column.name }))}
            />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <KanbanBoard project={project} />
      </div>

      <TaskDetailsSheet
        projectId={project.id}
        task={selectedTask}
        columns={project.columns.map((column) => ({ id: column.id, name: column.name }))}
      />
    </div>
  );
}
