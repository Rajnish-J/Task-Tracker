"use client";

import * as React from "react";

import { getTagsAction } from "@/app/actions";
import { useSpace } from "@/components/space-context";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TAG_COLOR_META, TAG_COLOR_OPTIONS } from "@/lib/constants";

const NEW = "__new__";
const NONE = "";

type TagOption = { id: string; name: string; color: string };

// Reusable, single-tag picker for any create/edit <form action={...}>. Loads the
// workspace tag pool on mount, lets the user pick an existing tag or define a new
// one, and emits hidden inputs the server action reads:
//   - tagId            → an existing tag was chosen
//   - tagName + tagColor → a brand-new tag to find-or-create
//   - (nothing)        → left untagged
export function TagPicker({
  defaultTag,
  idPrefix = "tag",
}: {
  defaultTag?: TagOption | null;
  idPrefix?: string;
}) {
  const { teamId } = useSpace();
  const [tags, setTags] = React.useState<TagOption[]>(defaultTag ? [defaultTag] : []);
  const [selection, setSelection] = React.useState<string>(defaultTag?.id ?? NONE);
  const [newName, setNewName] = React.useState("");
  const [newColor, setNewColor] = React.useState<string>(TAG_COLOR_OPTIONS[0]);

  React.useEffect(() => {
    let active = true;
    getTagsAction(teamId ?? undefined)
      .then((rows) => {
        if (!active) return;
        const merged =
          defaultTag && !rows.some((tag) => tag.id === defaultTag.id)
            ? [defaultTag, ...rows]
            : rows;
        setTags(merged);
      })
      .catch(() => {
        // Non-fatal: the picker still works for creating a new tag.
      });
    return () => {
      active = false;
    };
  }, [defaultTag, teamId]);

  const isNew = selection === NEW;
  const selectedExistingId = selection !== NEW && selection !== NONE ? selection : "";

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={`${idPrefix}-select`}>
        Tag
      </label>
      <Select
        value={selection}
        onValueChange={(next) => setSelection(next ?? NONE)}
        items={[
          { label: "No tag", value: NONE },
          ...tags.map((tag) => ({ label: tag.name, value: tag.id })),
          { label: "+ New tag…", value: NEW },
        ]}
      >
        <SelectTrigger id={`${idPrefix}-select`} aria-label="Tag" className="w-full">
          <SelectValue placeholder="No tag" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>No tag</SelectItem>
          {tags.map((tag) => (
            <SelectItem key={tag.id} value={tag.id}>
              {tag.name}
            </SelectItem>
          ))}
          <SelectItem value={NEW}>+ New tag…</SelectItem>
        </SelectContent>
      </Select>

      {isNew ? (
        <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
          <Input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            maxLength={40}
            placeholder="New tag name"
            aria-label="New tag name"
          />
          <Select
            value={newColor}
            onValueChange={(next) => next && setNewColor(next)}
            items={TAG_COLOR_OPTIONS.map((color) => ({
              label: TAG_COLOR_META[color]?.label ?? "Color",
              value: color,
            }))}
          >
            <SelectTrigger aria-label="New tag color" className="w-full">
              <SelectValue placeholder="Color" />
            </SelectTrigger>
            <SelectContent>
              {TAG_COLOR_OPTIONS.map((color) => (
                <SelectItem key={color} value={color}>
                  {TAG_COLOR_META[color]?.label ?? "Color"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {selectedExistingId ? (
        <input type="hidden" name="tagId" value={selectedExistingId} />
      ) : null}
      {isNew && newName.trim() ? (
        <>
          <input type="hidden" name="tagName" value={newName.trim()} />
          <input type="hidden" name="tagColor" value={newColor} />
        </>
      ) : null}
    </div>
  );
}
