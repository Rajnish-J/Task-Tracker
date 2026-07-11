import releases from "@/content/changelog.json";

export type ReleaseBadge = "New" | "Fixed" | "Changed";

export type ReleaseEntry = {
  version: string;
  date: string;
  badge: ReleaseBadge;
  title: string;
  details?: string[];
  commit?: string;
};

// Newest first. `content/changelog.json` is the only file the release
// automation (scripts/release.mjs, run from .github/workflows/release.yml)
// edits — it prepends one entry per push to main.
export const CHANGELOG = releases as ReleaseEntry[];

export const CURRENT_VERSION = CHANGELOG[0]?.version ?? "0.0.0";
