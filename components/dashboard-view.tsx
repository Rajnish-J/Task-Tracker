import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FolderKanban,
  LayoutList,
  ListChecks,
  Loader2,
} from "lucide-react";

import { DashboardCharts } from "@/components/dashboard-charts";
import { DashboardShell } from "@/components/dashboard-shell";
import { TagBadge } from "@/components/tag-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  getDashboardData,
  getTaggedItems,
  getTags,
  type DashboardData,
  type Tag,
  type TaggedItems,
} from "@/lib/data";

// Server view shared by the personal and team dashboard pages: fetches the
// space's data and renders the full dashboard. `basePath` prefixes every
// project/section link ("" personal, "/teams/:id" in a team).
export async function DashboardView({
  selectedTagId,
  teamId,
}: {
  selectedTagId?: string;
  teamId?: string;
}) {
  const basePath = teamId ? `/teams/${teamId}` : "";
  const [data, tags] = await Promise.all([
    getDashboardData(selectedTagId, teamId),
    getTags(teamId),
  ]);
  const tagged = selectedTagId ? await getTaggedItems(selectedTagId, teamId) : null;
  const selectedTag = selectedTagId ? tags.find((tag) => tag.id === selectedTagId) : undefined;

  return (
    <DashboardShell
      tags={tags}
      selectedTagId={selectedTagId}
      badges={<HeaderBadges data={data} />}
    >
      <DashboardBody data={data} tagged={tagged} selectedTag={selectedTag} basePath={basePath} />
    </DashboardShell>
  );
}

function HeaderBadges({ data }: { data: DashboardData }) {
  const completionRate =
    data.totalTasks > 0 ? Math.round((data.done / data.totalTasks) * 100) : 0;

  return (
    <>
      <Badge variant="secondary">{data.totalProjects} projects</Badge>
      <Badge variant="secondary">{data.totalTasks} cards</Badge>
      <Badge variant="secondary">{completionRate}% done</Badge>
    </>
  );
}

function DashboardBody({
  data,
  tagged,
  selectedTag,
  basePath,
}: {
  data: DashboardData;
  tagged: TaggedItems | null;
  selectedTag?: Tag;
  basePath: string;
}) {
  const taskCompletionRate =
    data.totalStoryTasks > 0
      ? Math.round((data.storyTasksDone / data.totalStoryTasks) * 100)
      : 0;

  const stats = [
    {
      label: "Projects",
      value: data.totalProjects,
      helper: "Active boards in the workspace",
      icon: FolderKanban,
      accent: "text-sky-600 dark:text-sky-300",
    },
    {
      label: "Total cards",
      value: data.totalTasks,
      helper: "Tasks across every board",
      icon: LayoutList,
      accent: "text-violet-600 dark:text-violet-300",
    },
    {
      label: "To do",
      value: data.todo,
      helper: "Waiting to be started",
      icon: ListChecks,
      accent: "text-sky-600 dark:text-sky-300",
    },
    {
      label: "In progress",
      value: data.inProgress,
      helper: "Currently being worked on",
      icon: Loader2,
      accent: "text-amber-600 dark:text-amber-300",
    },
    {
      label: "Done",
      value: data.done,
      helper: "Completed cards",
      icon: CheckCircle2,
      accent: "text-emerald-600 dark:text-emerald-300",
    },
    {
      label: "Overdue",
      value: data.overdue,
      helper: "Past due date, not done",
      icon: AlertTriangle,
      accent: "text-rose-600 dark:text-rose-300",
    },
    {
      label: "Due soon",
      value: data.dueSoon,
      helper: "Due within the next 7 days",
      icon: CalendarClock,
      accent: "text-amber-600 dark:text-amber-300",
    },
    {
      label: "Total tasks",
      value: data.totalStoryTasks,
      helper: "Checklist items across all cards",
      icon: ListChecks,
      accent: "text-violet-600 dark:text-violet-300",
    },
    {
      label: "Tasks done",
      value: data.storyTasksDone,
      helper: "Completed checklist items",
      icon: CheckCircle2,
      accent: "text-emerald-600 dark:text-emerald-300",
    },
    {
      label: "Task completion",
      value: taskCompletionRate,
      suffix: "%",
      helper: "Share of checklist items done",
      icon: CheckCircle2,
      accent: "text-emerald-600 dark:text-emerald-300",
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* KPI section cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className={cn("size-4", stat.accent)} />
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-3xl font-semibold tracking-tight tabular-nums">
                {stat.value.toLocaleString()}
                {"suffix" in stat ? stat.suffix : ""}
              </div>
              <p className="text-xs text-muted-foreground">{stat.helper}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Charts */}
      <DashboardCharts
        statusBreakdown={data.statusBreakdown}
        priorityBreakdown={data.priorityBreakdown}
        storyTaskBreakdown={data.storyTaskBreakdown}
      />

      {/* Tagged items — only shown when a tag filter is active */}
      {tagged && selectedTag ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <span>Tagged items</span>
              <TagBadge tag={selectedTag} />
              <span className="text-sm font-normal text-muted-foreground">
                {tagged.sections.length} sections · {tagged.projects.length} projects ·{" "}
                {tagged.boards.length} boards · {tagged.items.length} tasks
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Sections</h3>
              {tagged.sections.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sections with this tag.</p>
              ) : (
                <ul className="divide-y divide-border/60 rounded-md border border-border/60">
                  {tagged.sections.map((section) => (
                    <li key={section.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <Link href={`${basePath}/sections/${section.id}`} className="font-medium hover:underline">
                        {section.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">Section</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Projects</h3>
              {tagged.projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No projects with this tag.</p>
              ) : (
                <ul className="divide-y divide-border/60 rounded-md border border-border/60">
                  {tagged.projects.map((project) => (
                    <li key={project.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <Link href={`${basePath}/projects/${project.id}`} className="font-medium hover:underline">
                        {project.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">Project</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Boards</h3>
              {tagged.boards.length === 0 ? (
                <p className="text-sm text-muted-foreground">No boards with this tag.</p>
              ) : (
                <ul className="divide-y divide-border/60 rounded-md border border-border/60">
                  {tagged.boards.map((board) => (
                    <li key={board.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <Link
                        href={`${basePath}/projects/${board.projectId}?task=${board.id}`}
                        className="font-medium hover:underline"
                      >
                        {board.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {board.project?.name}
                        {board.column?.name ? ` · ${board.column.name}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Tasks</h3>
              {tagged.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks with this tag.</p>
              ) : (
                <ul className="divide-y divide-border/60 rounded-md border border-border/60">
                  {tagged.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      {item.task?.project ? (
                        <Link
                          href={`${basePath}/projects/${item.task.project.id}?task=${item.taskId}`}
                          className={cn(
                            "font-medium hover:underline",
                            item.isDone && "text-muted-foreground line-through",
                          )}
                        >
                          {item.title}
                        </Link>
                      ) : (
                        <span className="font-medium">{item.title}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {item.task?.title}
                        {item.task?.project?.name ? ` · ${item.task.project.name}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Per-project table — the full overview, shown only when no tag filter
          is narrowing the view. When a tag is selected the Tagged items card
          above replaces it so the filter has a clear, visible effect. */}
      {!selectedTag ? (
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {data.projects.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No projects yet. Create your first board to see stats here.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Columns</TableHead>
                    <TableHead className="text-right">Cards</TableHead>
                    <TableHead className="text-right">Tasks</TableHead>
                    <TableHead className="text-right">To do</TableHead>
                    <TableHead className="text-right">In progress</TableHead>
                    <TableHead className="text-right">Done</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell>
                        <Link
                          href={`${basePath}/projects/${project.id}`}
                          className="font-medium hover:underline"
                        >
                          {project.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {project.columnCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {project.taskCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {project.storyTasksDone}/{project.totalStoryTasks}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <StatusPill
                          value={project.todo}
                          className="bg-sky-500/15 text-sky-600 dark:text-sky-300"
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <StatusPill
                          value={project.inProgress}
                          className="bg-amber-500/15 text-amber-600 dark:text-amber-300"
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <StatusPill
                          value={project.done}
                          className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                        />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {format(project.updatedAt, "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function StatusPill({ value, className }: { value: number; className: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-7 items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {value}
    </span>
  );
}
