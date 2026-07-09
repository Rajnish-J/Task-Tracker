export const DEFAULT_COLUMNS = [
  { name: "To Do", color: "bg-sky-500/15 text-sky-600 dark:text-sky-300" },
  { name: "In Progress", color: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
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

// Friendly label + solid swatch class for each accent value. Swatch classes are
// written as literals so Tailwind's scanner generates them.
export const COLUMN_ACCENT_META: Record<string, { label: string; swatch: string }> = {
  "bg-sky-500/15 text-sky-600 dark:text-sky-300": { label: "Sky", swatch: "bg-sky-500" },
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300": { label: "Emerald", swatch: "bg-emerald-500" },
  "bg-amber-500/15 text-amber-600 dark:text-amber-300": { label: "Amber", swatch: "bg-amber-500" },
  "bg-violet-500/15 text-violet-600 dark:text-violet-300": { label: "Violet", swatch: "bg-violet-500" },
  "bg-rose-500/15 text-rose-600 dark:text-rose-300": { label: "Rose", swatch: "bg-rose-500" },
  "bg-slate-500/15 text-slate-600 dark:text-slate-300": { label: "Slate", swatch: "bg-slate-500" },
};

// Tags reuse the same accent palette as columns so we don't grow the Tailwind
// safelist. Kept as separate exports so tag UI reads clearly at call sites.
export const TAG_COLOR_OPTIONS = COLUMN_COLOR_OPTIONS;

export const TAG_COLOR_META = COLUMN_ACCENT_META;

// Teams reuse the same accent palette for their identity color.
export const TEAM_COLOR_OPTIONS = COLUMN_COLOR_OPTIONS;

export const TEAM_COLOR_META = COLUMN_ACCENT_META;

// A user may create at most this many teams (membership in other people's
// teams doesn't count; deleting a team frees the slot).
export const TEAM_CREATION_LIMIT = 2;

// Comma-separated env override; hardcoded fallback keeps the exemption
// working with no env change.
export const TEAM_LIMIT_EXEMPT_EMAILS = (
  process.env.TEAM_LIMIT_EXEMPT_EMAILS ?? "rajalehe7102@gmail.com"
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
