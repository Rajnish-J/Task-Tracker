"use client";

import { Tag as TagIcon } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TagOption = { id: string; name: string; color: string };

const ALL = "";

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

  const items = [
    { label: "All tags", value: ALL },
    ...tags.map((tag) => ({ label: tag.name, value: tag.id })),
  ];

  return (
    <div className="flex items-center gap-2">
      <TagIcon className="size-4 text-muted-foreground" />
      <label className="text-sm font-medium text-muted-foreground" htmlFor="board-tag-filter">
        Filter by tag
      </label>
      <Select
        value={value}
        onValueChange={(next) => onChange(next ?? ALL)}
        items={items}
      >
        <SelectTrigger id="board-tag-filter" aria-label="Filter by tag" className="h-9 min-w-44">
          <SelectValue placeholder="All tags" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value || "__all__"} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
