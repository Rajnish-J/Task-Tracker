"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  addMonths,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import {
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  FolderKanban,
  ListFilter,
  X,
} from "lucide-react";

import { PRIORITY_OPTIONS } from "@/lib/constants";
import type { TimelineData } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type View = "week" | "month" | "year";

type StatusKey = "todo" | "inProgress" | "review" | "done" | "other";

// Mirror of lib/data's status mapping. Kept local so this client component
// never pulls the server-only db module into the browser bundle.
function statusKeyFromColumnName(name: string): StatusKey {
  const normalized = name.trim().toLowerCase();
  if (normalized === "to do" || normalized === "todo" || normalized === "backlog") return "todo";
  if (normalized === "in progress" || normalized === "doing") return "inProgress";
  if (normalized === "review" || normalized === "in review") return "review";
  if (normalized === "done" || normalized === "completed") return "done";
  return "other";
}

const STATUS_META: Record<StatusKey, { label: string; bar: string; accent: string; dot: string }> = {
  todo: {
    label: "To Do",
    bar: "bg-linear-to-r from-sky-500/30 to-sky-500/10 text-sky-700 ring-sky-500/30 dark:text-sky-100 dark:from-sky-400/35 dark:to-sky-400/10",
    accent: "bg-sky-500",
    dot: "bg-sky-500",
  },
  inProgress: {
    label: "In Progress",
    bar: "bg-linear-to-r from-amber-500/30 to-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-100 dark:from-amber-400/35 dark:to-amber-400/10",
    accent: "bg-amber-500",
    dot: "bg-amber-500",
  },
  review: {
    label: "Review",
    bar: "bg-linear-to-r from-violet-500/30 to-violet-500/10 text-violet-700 ring-violet-500/30 dark:text-violet-100 dark:from-violet-400/35 dark:to-violet-400/10",
    accent: "bg-violet-500",
    dot: "bg-violet-500",
  },
  done: {
    label: "Done",
    bar: "bg-linear-to-r from-emerald-500/30 to-emerald-500/10 text-emerald-700 ring-emerald-500/30 dark:text-emerald-100 dark:from-emerald-400/35 dark:to-emerald-400/10",
    accent: "bg-emerald-500",
    dot: "bg-emerald-500",
  },
  other: {
    label: "Other",
    bar: "bg-linear-to-r from-slate-500/30 to-slate-500/10 text-slate-700 ring-slate-500/30 dark:text-slate-100 dark:from-slate-400/35 dark:to-slate-400/10",
    accent: "bg-slate-500",
    dot: "bg-slate-500",
  },
};

const PRIORITY_DOT: Record<string, string> = {
  LOW: "bg-slate-400",
  MEDIUM: "bg-sky-500",
  HIGH: "bg-amber-500",
  URGENT: "bg-rose-500",
};

const STATUS_KEYS: StatusKey[] = ["todo", "inProgress", "review", "done", "other"];

const LEFT_WIDTH = 248;
const ROW_H = 44;
const MIN_BAR = 30;

type ColumnSpec = {
  start: Date;
  end: Date;
  offset: number;
  width: number;
  top: string;
  sub: string;
  isWeekend: boolean;
};

function buildColumns(view: View, anchor: Date): { columns: ColumnSpec[]; total: number; colWidth: number } {
  let bins: { start: Date; end: Date; top: string; sub: string }[] = [];
  let colWidth = 64;

  if (view === "week") {
    colWidth = 64;
    const start = startOfWeek(anchor, { weekStartsOn: 1 });
    bins = Array.from({ length: 14 }, (_, i) => {
      const d = addDays(start, i);
      return { start: startOfDay(d), end: addDays(startOfDay(d), 1), top: format(d, "d"), sub: format(d, "EEE").toUpperCase() };
    });
  } else if (view === "month") {
    colWidth = 40;
    const s = startOfMonth(anchor);
    const e = endOfMonth(anchor);
    bins = eachDayOfInterval({ start: s, end: e }).map((d) => ({
      start: startOfDay(d),
      end: addDays(startOfDay(d), 1),
      top: format(d, "d"),
      sub: format(d, "EEEEE"),
    }));
  } else {
    colWidth = 104;
    const s = startOfYear(anchor);
    bins = Array.from({ length: 12 }, (_, i) => {
      const m = addMonths(s, i);
      return { start: startOfMonth(m), end: startOfMonth(addMonths(m, 1)), top: format(m, "MMM"), sub: format(m, "yyyy") };
    });
  }

  let offset = 0;
  const columns: ColumnSpec[] = bins.map((b) => {
    const day = b.start.getDay();
    const col: ColumnSpec = {
      ...b,
      offset,
      width: colWidth,
      isWeekend: view !== "year" && (day === 0 || day === 6),
    };
    offset += colWidth;
    return col;
  });

  return { columns, total: offset, colWidth };
}

function dateToX(date: Date, columns: ColumnSpec[], total: number): number {
  if (columns.length === 0) return 0;
  if (date.getTime() <= columns[0].start.getTime()) return 0;
  const last = columns[columns.length - 1];
  if (date.getTime() >= last.end.getTime()) return total;
  for (const c of columns) {
    if (date.getTime() >= c.start.getTime() && date.getTime() < c.end.getTime()) {
      const frac = (date.getTime() - c.start.getTime()) / (c.end.getTime() - c.start.getTime());
      return c.offset + frac * c.width;
    }
  }
  return total;
}

type BarItem = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  hasDue: boolean;
  status: StatusKey;
  priority: string;
  isSubtask: boolean;
  done?: boolean;
};

export function TimelineBoard({ projects }: { projects: TimelineData }) {
  const router = useRouter();
  const [view, setView] = React.useState<View>("week");
  const [anchor, setAnchor] = React.useState<Date>(() => new Date());

  const allProjectIds = React.useMemo(() => projects.map((p) => p.id), [projects]);
  const allPriorities = React.useMemo(() => PRIORITY_OPTIONS.map((p) => p.value as string), []);

  const availableStatuses = React.useMemo(() => {
    const set = new Set<StatusKey>();
    for (const project of projects) {
      for (const column of project.columns) set.add(statusKeyFromColumnName(column.name));
    }
    return STATUS_KEYS.filter((k) => set.has(k));
  }, [projects]);

  const [collapsedTasks, setCollapsedTasks] = React.useState<Set<string>>(new Set());
  const toggleTask = React.useCallback((id: string) => {
    setCollapsedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(new Set());
  const toggleGroup = React.useCallback((id: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const [projectFilter, setProjectFilter] = React.useState<Set<string>>(() => new Set(allProjectIds));
  const [priorityFilter, setPriorityFilter] = React.useState<Set<string>>(() => new Set(allPriorities));
  const [statusFilter, setStatusFilter] = React.useState<Set<StatusKey>>(() => new Set(STATUS_KEYS));

  const { columns, total } = React.useMemo(() => buildColumns(view, anchor), [view, anchor]);
  const windowStart = columns[0]?.start ?? startOfDay(anchor);
  const windowEnd = columns[columns.length - 1]?.end ?? addDays(windowStart, 1);

  const periodLabel = React.useMemo(() => {
    if (view === "week") {
      const first = columns[0]?.start ?? anchor;
      const last = columns[columns.length - 1]?.start ?? anchor;
      return `${format(first, "MMM d")} — ${format(last, "MMM d, yyyy")}`;
    }
    if (view === "month") return format(anchor, "MMMM yyyy");
    return format(anchor, "yyyy");
  }, [view, anchor, columns]);

  function shift(direction: 1 | -1) {
    setAnchor((current) => {
      if (view === "week") return addDays(current, direction * 14);
      if (view === "month") return addMonths(current, direction);
      return addYears(current, direction);
    });
  }

  const overlaps = React.useCallback(
    (start: Date, end: Date) =>
      end.getTime() >= windowStart.getTime() && start.getTime() <= windowEnd.getTime(),
    [windowStart, windowEnd]
  );

  // Build the visible row groups, applying all filters.
  const groups = React.useMemo(() => {
    return projects
      .filter((project) => projectFilter.has(project.id))
      .map((project) => {
        const rows: { task: BarItem; subtasks: BarItem[] }[] = [];

        for (const column of project.columns) {
          const status = statusKeyFromColumnName(column.name);
          if (!statusFilter.has(status)) continue;

          for (const task of column.tasks) {
            if (!priorityFilter.has(task.priority)) continue;

            const start = startOfDay(task.createdAt);
            const end = task.dueDate ? startOfDay(task.dueDate) : start;
            if (!overlaps(start, end)) continue;

            const taskBar: BarItem = {
              id: task.id,
              title: task.title,
              start,
              end,
              hasDue: Boolean(task.dueDate),
              status,
              priority: task.priority,
              isSubtask: false,
            };

            const subtasks: BarItem[] = task.storyTasks
              .filter((sub) => priorityFilter.has(sub.priority))
              .map((sub) => {
                const subStart = startOfDay(sub.createdAt);
                const subEnd = sub.dueDate ? startOfDay(sub.dueDate) : subStart;
                return {
                  id: task.id, // open the parent task modal
                  title: sub.title,
                  start: subStart,
                  end: subEnd,
                  hasDue: Boolean(sub.dueDate),
                  status,
                  priority: sub.priority,
                  isSubtask: true,
                  done: sub.isDone,
                };
              })
              .filter((sub) => overlaps(sub.start, sub.end));

            rows.push({ task: taskBar, subtasks });
          }
        }

        return { id: project.id, name: project.name, rows };
      })
      .filter((group) => group.rows.length > 0);
  }, [projects, projectFilter, priorityFilter, statusFilter, overlaps]);

  const visibleTaskCount = groups.reduce((sum, g) => sum + g.rows.length, 0);

  // Collapse/expand every project group at once. When all are already
  // collapsed, the same button expands them back.
  const allGroupsCollapsed =
    groups.length > 0 && groups.every((g) => collapsedGroups.has(g.id));
  function toggleCollapseAll() {
    setCollapsedGroups(allGroupsCollapsed ? new Set() : new Set(groups.map((g) => g.id)));
  }

  function openTask(id: string) {
    router.push(`/timeline?task=${id}`);
  }

  function clearAll() {
    setProjectFilter(new Set(allProjectIds));
    setPriorityFilter(new Set(allPriorities));
    setStatusFilter(new Set(STATUS_KEYS));
  }

  const hasActiveFilters =
    projectFilter.size < allProjectIds.length ||
    priorityFilter.size < allPriorities.length ||
    statusFilter.size < STATUS_KEYS.length;

  const todayTime = startOfDay(new Date()).getTime();
  const todayX = dateToX(startOfDay(new Date()), columns, total);
  const showToday = todayTime >= windowStart.getTime() && todayTime < windowEnd.getTime();

  const gridBackground = {
    backgroundImage: `repeating-linear-gradient(to right, var(--border) 0, var(--border) 1px, transparent 1px, transparent ${columns[0]?.width ?? 64}px)`,
  } as React.CSSProperties;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
              <CalendarRange className="size-4 text-muted-foreground" />
              {projects.length} {projects.length === 1 ? "project" : "projects"}
              <span className="font-normal text-muted-foreground">· {visibleTaskCount} shown</span>
            </span>

            <MultiSelectFilter
              icon={<FolderKanban className="size-3.5" />}
              label="Projects"
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              selected={projectFilter}
              setSelected={setProjectFilter}
            />
            <MultiSelectFilter
              icon={<ListFilter className="size-3.5" />}
              label="Priority"
              options={PRIORITY_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
              selected={priorityFilter}
              setSelected={setPriorityFilter}
            />
            <MultiSelectFilter
              icon={<ListFilter className="size-3.5" />}
              label="Status"
              options={availableStatuses.map((s) => ({ value: s, label: STATUS_META[s].label }))}
              selected={statusFilter as Set<string>}
              setSelected={setStatusFilter as React.Dispatch<React.SetStateAction<Set<string>>>}
            />
            {hasActiveFilters ? (
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">
                <X className="size-3.5" /> Clear all
              </Button>
            ) : null}
            {groups.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleCollapseAll}
                className="gap-1.5"
                aria-pressed={allGroupsCollapsed}
              >
                {allGroupsCollapsed ? (
                  <ChevronsUpDown className="size-3.5" />
                ) : (
                  <ChevronsDownUp className="size-3.5" />
                )}
                {allGroupsCollapsed ? "Expand all" : "Collapse all"}
              </Button>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background p-0.5 text-sm font-medium shadow-xs">
              <Button variant="ghost" size="icon-sm" aria-label="Previous period" onClick={() => shift(-1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-44 text-center tabular-nums">{periodLabel}</span>
              <Button variant="ghost" size="icon-sm" aria-label="Next period" onClick={() => shift(1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>

            <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>
              Today
            </Button>

            <div className="flex items-center rounded-lg border border-border/60 bg-background p-0.5 shadow-xs">
              {(["week", "month", "year"] as View[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setView(value)}
                  className={cn(
                    "rounded-md px-3 py-1 text-sm font-medium capitalize transition-all",
                    view === value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">Status</span>
          {availableStatuses.map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-full", STATUS_META[status].accent)} />
              {STATUS_META[status].label}
            </span>
          ))}
          <span className="mx-1 h-3 w-px bg-border" />
          <span className="font-medium text-foreground/70">Priority</span>
          {PRIORITY_OPTIONS.map((option) => (
            <span key={option.value} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", PRIORITY_DOT[option.value])} />
              {option.label}
            </span>
          ))}
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-hidden p-3 md:p-4">
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          {groups.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
              <CalendarRange className="size-8 text-muted-foreground/50" />
              <p className="text-sm font-medium">No tasks for this period</p>
              <p className="text-sm text-muted-foreground">
                Try a wider view, a different date range, or clearing your filters.
              </p>
            </div>
          ) : (
            <div className="relative flex-1 overflow-auto">
              <div className="min-w-fit">
                {/* Header row */}
                <div className="sticky top-0 z-20 flex border-b border-border/60 bg-muted/40 backdrop-blur">
                  <div
                    className="sticky left-0 z-30 flex items-center border-r border-border/60 bg-muted/40 px-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
                    style={{ width: LEFT_WIDTH, height: ROW_H }}
                  >
                    Projects / Tasks
                  </div>
                  <div className="relative flex" style={{ width: total, height: ROW_H }}>
                    {columns.map((col, i) => {
                      const isToday = todayTime >= col.start.getTime() && todayTime < col.end.getTime();
                      return (
                        <div
                          key={i}
                          className={cn(
                            "flex flex-col items-center justify-center border-r border-border/40 text-center",
                            col.isWeekend && "bg-muted/50",
                            isToday && "bg-primary/10"
                          )}
                          style={{ width: col.width }}
                        >
                          <span
                            className={cn(
                              "text-[11px] leading-none font-semibold",
                              isToday && "text-primary"
                            )}
                          >
                            {col.top}
                          </span>
                          <span className="mt-0.5 text-[10px] leading-none text-muted-foreground">{col.sub}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Groups */}
                {groups.map((group) => {
                  const groupCollapsed = collapsedGroups.has(group.id);
                  return (
                  <div key={group.id}>
                    {/* Project group header */}
                    <div className="flex border-b border-border/60 bg-linear-to-r from-muted/70 to-muted/20">
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.id)}
                        aria-label={groupCollapsed ? "Expand group" : "Collapse group"}
                        aria-expanded={!groupCollapsed}
                        className="sticky left-0 z-10 flex items-center gap-2 border-r border-border/60 bg-muted/60 px-4 text-left text-sm font-semibold hover:bg-muted/80"
                        style={{ width: LEFT_WIDTH, height: ROW_H }}
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <FolderKanban className="size-3.5" />
                        </span>
                        <span className="truncate">{group.name}</span>
                        <span className="ml-auto flex items-center gap-2">
                          <Badge variant="secondary">{group.rows.length}</Badge>
                          {groupCollapsed ? (
                            <ChevronRight className="size-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="size-4 text-muted-foreground" />
                          )}
                        </span>
                      </button>
                      <div className="relative" style={{ width: total, height: ROW_H }} />
                    </div>

                {!groupCollapsed && group.rows.map(({ task, subtasks }) => {
                  const hasSubtasks = subtasks.length > 0;
                  const collapsed = collapsedTasks.has(task.id);
                  return (
                  <React.Fragment key={task.id}>
                    <TimelineRow
                      item={task}
                      columns={columns}
                      total={total}
                      gridBackground={gridBackground}
                      showToday={showToday}
                      todayX={todayX}
                      onOpen={openTask}
                      collapsible={hasSubtasks}
                      collapsed={collapsed}
                      onToggleCollapse={() => toggleTask(task.id)}
                    />
                    {hasSubtasks && !collapsed
                      ? subtasks.map((sub, idx) => (
                      <TimelineRow
                        key={`${task.id}-sub-${idx}`}
                        item={sub}
                        columns={columns}
                        total={total}
                        gridBackground={gridBackground}
                        showToday={showToday}
                        todayX={todayX}
                        onOpen={openTask}
                      />
                    ))
                      : null}
                  </React.Fragment>
                  );
                })}
                    </div>
                  );
                })}
                </div>
              </div>
            )}
          </div>
        </div>
    </div>
  );
}

function TimelineRow({
  item,
  columns,
  total,
  gridBackground,
  showToday,
  todayX,
  onOpen,
  collapsible = false,
  collapsed = false,
  onToggleCollapse,
}: {
  item: BarItem;
  columns: ColumnSpec[];
  total: number;
  gridBackground: React.CSSProperties;
  showToday: boolean;
  todayX: number;
  onOpen: (id: string) => void;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const left = dateToX(item.start, columns, total);
  // Render the bar through to the END of the due day so single-day items are visible.
  const right = dateToX(item.hasDue ? addDays(item.end, 1) : addDays(item.start, 1), columns, total);
  const width = Math.max(right - left, MIN_BAR);
  const meta = STATUS_META[item.status];

  return (
    <div className="flex border-b border-border/40 hover:bg-muted/20">
      <div
        className={cn(
          "sticky left-0 z-10 flex items-center gap-2 border-r border-border/60 bg-background px-4",
          item.isSubtask && "pl-9"
        )}
        style={{ width: LEFT_WIDTH, height: ROW_H }}
      >
        {item.isSubtask ? null : collapsible ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse?.();
            }}
            aria-label={collapsed ? "Expand project" : "Collapse project"}
            aria-expanded={!collapsed}
            className="-ml-1 flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        ) : (
          <span className="-ml-1 size-4 shrink-0" />
        )}
        <span className={cn("size-1.5 shrink-0 rounded-full", PRIORITY_DOT[item.priority] ?? "bg-slate-400")} />
        <span
          className={cn(
            "truncate text-sm",
            item.isSubtask ? "text-muted-foreground" : "font-medium",
            item.done && "line-through opacity-60"
          )}
          title={item.title}
        >
          {item.title}
        </span>
      </div>

      <div className="relative" style={{ width: total, height: ROW_H, ...gridBackground }}>
        {showToday ? (
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-0 w-px bg-primary/50"
            style={{ left: todayX }}
          />
        ) : null}
        <button
          type="button"
          onClick={() => onOpen(item.id)}
          title={`${item.title} · ${meta.label}${item.hasDue ? ` · due ${format(item.end, "MMM d, yyyy")}` : ""}`}
          className={cn(
            "group absolute top-1/2 z-10 flex -translate-y-1/2 items-center gap-1.5 overflow-hidden rounded-md pr-2.5 text-xs font-medium shadow-sm ring-1 ring-inset transition-all hover:z-20 hover:shadow-md hover:brightness-105 focus-visible:outline-2 focus-visible:outline-ring",
            item.isSubtask ? "h-5" : "h-6",
            meta.bar
          )}
          style={{ left, width }}
        >
          <span className={cn("h-full w-1 shrink-0", meta.accent)} />
          <span className={cn("size-1.5 shrink-0 rounded-full", meta.dot)} />
          <span className="truncate">{item.title}</span>
        </button>
      </div>
    </div>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-md border transition-colors",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-transparent"
      )}
    >
      {checked ? <Check className="size-3" strokeWidth={3} /> : null}
    </span>
  );
}

function MultiSelectFilter({
  icon,
  label,
  options,
  selected,
  setSelected,
}: {
  icon: React.ReactNode;
  label: string;
  options: { value: string; label: string }[];
  selected: Set<string>;
  setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const activeCount = options.filter((o) => selected.has(o.value)).length;
  const allChecked = activeCount === options.length && options.length > 0;
  const isFiltered = activeCount < options.length;

  // Hide the default right-aligned tick so only our left-aligned checkbox shows.
  const itemClassName = "gap-2 pr-2 [&_[data-slot=dropdown-menu-checkbox-item-indicator]]:hidden";

  function toggleOne(value: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function toggleAll() {
    setSelected(() => (allChecked ? new Set<string>() : new Set(options.map((o) => o.value))));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            {icon}
            {label}
            {isFiltered ? (
              <Badge variant="secondary" className="ml-0.5">
                {activeCount}
              </Badge>
            ) : null}
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="min-w-48">
        <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
          Filter by {label.toLowerCase()}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={allChecked}
          onCheckedChange={toggleAll}
          onClick={(event) => event.preventDefault()}
          className={cn(itemClassName, "font-medium")}
        >
          <CheckBox checked={allChecked} />
          All
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {options.map((option) => {
          const checked = selected.has(option.value);
          return (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={checked}
              onCheckedChange={() => toggleOne(option.value)}
              onClick={(event) => event.preventDefault()}
              className={itemClassName}
            >
              <CheckBox checked={checked} />
              {option.label}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
