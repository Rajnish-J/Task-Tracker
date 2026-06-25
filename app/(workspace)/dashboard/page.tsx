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
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { getDashboardData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();

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

  const completionRate =
    data.totalTasks > 0 ? Math.round((data.done / data.totalTasks) * 100) : 0;

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto">
      <header className="border-b border-border/60 bg-background/80 px-4 py-4 backdrop-blur md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <SidebarTrigger className="-ml-1 text-foreground" />
              <span>Workspace</span>
              <span>/</span>
              <span className="text-foreground">Dashboard</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
              <Badge variant="secondary">{data.totalProjects} projects</Badge>
              <Badge variant="secondary">{data.totalTasks} cards</Badge>
              <Badge variant="secondary">{completionRate}% done</Badge>
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              A live overview of every board — how many cards exist and how they
              break down by status, priority, and due date.
            </p>
          </div>
        </div>
      </header>

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

        {/* Per-project table */}
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
                          href={`/projects/${project.id}`}
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
      </div>
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
