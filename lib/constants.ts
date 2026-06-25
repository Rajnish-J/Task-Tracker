export const DEFAULT_COLUMNS = [
  { name: "To Do", color: "bg-sky-500/15 text-sky-600 dark:text-sky-300" },
  { name: "In Progress", color: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
  { name: "Review", color: "bg-violet-500/15 text-violet-600 dark:text-violet-300" },
  { name: "Done", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" },
] as const;

export const PRIORITY_OPTIONS = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
] as const;

export const COLUMN_COLOR_OPTIONS = [
  "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  "bg-slate-500/15 text-slate-600 dark:text-slate-300",
] as const;
