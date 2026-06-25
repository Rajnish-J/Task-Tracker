import { TaskDetailsSheet } from "@/components/task-details-sheet";
import { TimelineBoard } from "@/components/timeline-board";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getTimelineData } from "@/lib/data";

export const dynamic = "force-dynamic";

type TimelinePageProps = {
  searchParams: Promise<{ task?: string }>;
};

export default async function TimelinePage({ searchParams }: TimelinePageProps) {
  const { task: taskId } = await searchParams;
  const projects = await getTimelineData();

  // Locate the selected task (and its parent project's columns) across every project.
  const selected = taskId
    ? projects
        .flatMap((project) =>
          project.columns.flatMap((column) =>
            column.tasks.map((task) => ({ task, project }))
          )
        )
        .find(({ task }) => task.id === taskId) ?? null
    : null;

  const selectedProject = selected?.project ?? null;

  return (
    <div className="flex h-full flex-1 flex-col">
      <header className="border-b border-border/60 bg-background/80 px-4 py-4 backdrop-blur md:px-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <SidebarTrigger className="-ml-1 text-foreground" />
          <span className="text-foreground">Timeline</span>
        </div>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          Plan across every project. User stories and their subtasks laid out against time, from
          creation to due date.
        </p>
      </header>

      <div className="flex-1 overflow-hidden">
        <TimelineBoard projects={projects} />
      </div>

      {selectedProject ? (
        <TaskDetailsSheet
          projectId={selectedProject.id}
          task={selected!.task}
          columns={selectedProject.columns.map((column) => ({ id: column.id, name: column.name }))}
        />
      ) : (
        <TaskDetailsSheet projectId="" task={null} columns={[]} />
      )}
    </div>
  );
}
