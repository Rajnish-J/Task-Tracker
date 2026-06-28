"use client";

import { Tag as TagIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { nativeSelectClass, nativeSelectOptionClass } from "@/lib/select-styles";

type TagOption = { id: string; name: string; color: string };

const selectClassName = cn(nativeSelectClass, "h-9 w-auto min-w-44");

// Client-side tag filter for the Kanban / section boards. Unlike the dashboard
// filter it doesn't navigate — the parent board filters its cards in state, so
// the change is instant. Only tags actually present on the board are offered.
export function BoardTagFilter({
  tags,
  value,
  onChange,
}: {
  tags: TagOption[];
  value: string;
  onChange: (tagId: string) => void;
}) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <TagIcon className="size-4 text-muted-foreground" />
      <label className="text-sm font-medium text-muted-foreground" htmlFor="board-tag-filter">
        Filter by tag
      </label>
      <select
        id="board-tag-filter"
        value={value}
        onChange={(event) => onChange(event.target.value)}
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
