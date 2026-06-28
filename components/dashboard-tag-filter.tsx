"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tag as TagIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { nativeSelectClass, nativeSelectOptionClass } from "@/lib/select-styles";

type TagOption = { id: string; name: string; color: string };

const selectClassName = cn(nativeSelectClass, "w-auto min-w-48");

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
        <option className={nativeSelectOptionClass} value="">
          All tags
        </option>
        {tags.map((tag) => (
          <option className={nativeSelectOptionClass} key={tag.id} value={tag.id}>
            {tag.name}
          </option>
        ))}
      </select>
    </div>
  );
}
