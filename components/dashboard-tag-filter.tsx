"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tag as TagIcon } from "lucide-react";

type TagOption = { id: string; name: string; color: string };

const selectClassName =
  "h-9 min-w-48 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

// Drives the dashboard's tagged-items list via the `?tag=` query param. The page
// is a server component, so selecting a tag navigates and re-renders the list.
export function DashboardTagFilter({
  tags,
  selectedTagId,
}: {
  tags: TagOption[];
  selectedTagId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(value: string) {
    const params = new URLSearchParams();
    if (value) {
      params.set("tag", value);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex items-center gap-2">
      <TagIcon className="size-4 text-muted-foreground" />
      <label className="text-sm font-medium text-muted-foreground" htmlFor="dashboard-tag-filter">
        Filter by tag
      </label>
      <select
        id="dashboard-tag-filter"
        value={selectedTagId ?? ""}
        onChange={(event) => handleChange(event.target.value)}
        className={selectClassName}
        aria-label="Filter by tag"
      >
        <option value="">All tags</option>
        {tags.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.name}
          </option>
        ))}
      </select>
    </div>
  );
}
